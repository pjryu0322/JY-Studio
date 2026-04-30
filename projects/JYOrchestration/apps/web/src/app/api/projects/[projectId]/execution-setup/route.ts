import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  executionSetupSchemaDriftResponse,
  isExecutionSetupSchemaDriftError,
} from "@/lib/prisma/executionSetupSchemaMismatch";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { DEFAULT_CURSOR_API_BASE, normalizeCursorApiBaseUrl } from "@/lib/executionSetup/cursorApiValidation";
import { maskCursorTokenForUi } from "@/lib/executionSetup/cursorTokenMask";
import { maskGithubTokenForUi } from "@/lib/executionSetup/githubTokenMask";
import { maskOpenAiKeyForUi } from "@/lib/executionSetup/openAiKeyMask";
import { getUserDefaultExecutionCredentials } from "@/lib/service/userDefaultExecutionCredentials";
import {
  probeGithubPatAgainstExecutionRepo,
  sanitizeGithubPatForStorage,
  type GithubPatPostSaveRepoProbeResult,
} from "@/lib/integration/githubPatIntegrity";
import { githubTokenFingerprint, githubTokenPrefixForLog } from "@/lib/integration/githubTokenTrace";

function cursorTokenMaskedForApiResponse(cursorApiToken: string | null | undefined): string | null {
  const t = String(cursorApiToken ?? "").trim();
  return t ? maskCursorTokenForUi(t) : null;
}

function githubTokenMaskedForApiResponse(githubAccessToken: string | null | undefined): string | null {
  const t = String(githubAccessToken ?? "").trim();
  return t ? maskGithubTokenForUi(t) : null;
}

/** DB `*Masked` 컬럼과 평문 컬럼을 함께 본다(이전 마이그레이션·부분 저장 호환). */
function clientGithubTokenMeta(row: {
  githubAccessToken: string | null;
  githubAccessTokenMasked: string | null;
}): { masked: string | null; hasToken: boolean } {
  const fromPlain = githubTokenMaskedForApiResponse(row.githubAccessToken);
  const stored = String(row.githubAccessTokenMasked ?? "").trim();
  const masked = fromPlain || (stored ? stored : null);
  const hasToken = Boolean(String(row.githubAccessToken ?? "").trim()) || Boolean(stored);
  return { masked, hasToken };
}

function clientCursorTokenMeta(row: {
  cursorApiToken: string | null;
  cursorApiTokenMasked: string | null;
}): { masked: string | null; hasToken: boolean } {
  const fromPlain = cursorTokenMaskedForApiResponse(row.cursorApiToken);
  const stored = String(row.cursorApiTokenMasked ?? "").trim();
  const masked = fromPlain || (stored ? stored : null);
  const hasToken = Boolean(String(row.cursorApiToken ?? "").trim()) || Boolean(stored);
  return { masked, hasToken };
}

function clientOpenAiPlannerKeyMeta(row: {
  openaiPlannerApiKey?: string | null;
  openaiPlannerApiKeyMasked?: string | null;
}): { masked: string | null; hasToken: boolean } {
  const plain = String(row.openaiPlannerApiKey ?? "").trim();
  const fromPlain = plain ? maskOpenAiKeyForUi(plain) : "";
  const stored = String(row.openaiPlannerApiKeyMasked ?? "").trim();
  const masked = fromPlain || (stored ? stored : null);
  const hasToken = Boolean(plain) || Boolean(stored);
  return { masked, hasToken };
}

function isLikelyUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type PatchBody = Partial<{
  gitRepoUrl: string;
  gitRepoProvider: string;
  gitRepoName: string | null;
  baseBranch: string;
  branchStrategy: "feature-per-workflow" | "feature-per-task" | "manual";
  branchPrefix: string | null;

  allowedPathGlobs: string[];

  autoCommit: boolean;
  autoPush: boolean;
  autoPr: boolean;
  requireApprovalBeforeApply: boolean;
  requireTestsBeforePush: boolean;
  dryRunAllowed: boolean;

  autoAdvanceToNextTask: boolean;
  maxAutoRetriesPerTask: number;
  stopOnTestFailure: boolean;
  stopOnRepeatedFailure: boolean;
  stopOnOutOfScopeChange: boolean;
  requireApprovalForSensitiveTasks: boolean;

  cursorApiUrl: string;
  cursorApiToken: string | null;
  githubAccessToken: string | null;
  /** 프로토타입 AI 기획자용 OpenAI 키(프로젝트 단위) */
  openaiPlannerApiKey: string | null;
}>;

function toStringOrNull(v: unknown): string | null {
  if (v === null) return null;
  const s = String(v ?? "").trim();
  return s ? s : null;
}

/** owner/repo 입력의 앞뒤 슬래시·공백 제거(URL 파싱 결과와 맞춤) */
function normalizeGitRepoNameForDb(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return s ? s : null;
}

function toBoolOrUndefined(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  return undefined;
}

function toIntOrUndefined(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() && /^-?\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return undefined;
}

function toStringArrayOrUndefined(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const a = v.map((x) => String(x ?? "").trim()).filter(Boolean);
  return a;
}

function normalizeGlobsJson(g: unknown): string {
  const a = Array.isArray(g) ? g.map((x) => String(x ?? "").trim()).filter(Boolean) : [];
  return JSON.stringify([...a].sort());
}

function executionSetupOverallStatus(
  repoOk: boolean | null,
  githubAuthOk: boolean | null,
  cursorApiOk: boolean | null,
  execOk: boolean | null
): "draft" | "validated" | "invalid" {
  if (repoOk === true && githubAuthOk === true && cursorApiOk === true && execOk === true) return "validated";
  if (repoOk === false || githubAuthOk === false || cursorApiOk === false || execOk === false) return "invalid";
  return "draft";
}

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canViewProject", "GET /api/projects/[projectId]/execution-setup");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const row = await withExecutionSetupSchemaHealRetry(() =>
      prisma.executionSetup.findUnique({ where: { projectId: pid } })
    );
    if (!row) {
      const projectMetaNoRow = await prisma.project.findUnique({
        where: { id: pid },
        select: { ownerUserId: true },
      });
      let peerCredentialHintsNoRow: {
        githubAccessTokenMasked: string | null;
        cursorApiUrl: string | null;
        cursorApiTokenMasked: string | null;
      } | null = null;
      if (projectMetaNoRow?.ownerUserId) {
        const donor = await getUserDefaultExecutionCredentials(projectMetaNoRow.ownerUserId, pid);
        if (donor && (donor.githubAccessTokenMasked || donor.cursorApiTokenMasked)) {
          peerCredentialHintsNoRow = {
            githubAccessTokenMasked: donor.githubAccessTokenMasked,
            cursorApiUrl: donor.cursorApiUrl,
            cursorApiTokenMasked: donor.cursorApiTokenMasked,
          };
        }
      }
      return NextResponse.json({
        success: true,
        message: "Execution setup이 아직 없습니다.",
        data: null,
        peerCredentialHints: peerCredentialHintsNoRow,
      });
    }

    const ghTok = clientGithubTokenMeta(row);
    const curTok = clientCursorTokenMeta(row);
    const openAiTok = clientOpenAiPlannerKeyMeta(row);

    const projectMeta = await prisma.project.findUnique({
      where: { id: pid },
      select: { ownerUserId: true },
    });
    let peerCredentialHints: {
      githubAccessTokenMasked: string | null;
      cursorApiUrl: string | null;
      cursorApiTokenMasked: string | null;
    } | null = null;
    if (projectMeta?.ownerUserId) {
      const donor = await getUserDefaultExecutionCredentials(projectMeta.ownerUserId, pid);
      if (donor) {
        const needsGh = !ghTok.hasToken;
        const needsCur = !curTok.hasToken;
        const gh = needsGh ? donor.githubAccessTokenMasked : null;
        const cu = needsCur ? donor.cursorApiUrl : null;
        const ctm = needsCur ? donor.cursorApiTokenMasked : null;
        if (gh || ctm) {
          peerCredentialHints = {
            githubAccessTokenMasked: gh,
            cursorApiUrl: cu,
            cursorApiTokenMasked: ctm,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Execution setup을 조회했습니다.",
      data: {
        id: row.id,
        projectId: row.projectId,
        gitRepoUrl: row.gitRepoUrl,
        gitRepoProvider: row.gitRepoProvider ?? "github",
        gitRepoName: row.gitRepoName,
        baseBranch: row.baseBranch,
        branchStrategy: row.branchStrategy,
        branchPrefix: row.branchPrefix,
        githubAccessTokenMasked: ghTok.masked,
        hasGithubAccessToken: ghTok.hasToken,
        githubAuthConnectionOk: row.githubAuthConnectionOk ?? null,
        githubAuthValidatedAt: row.githubAuthValidatedAt ? row.githubAuthValidatedAt.toISOString() : null,
        githubAuthValidationError: row.githubAuthValidationError ?? null,
        githubCapabilityValidation: row.githubCapabilityValidation ?? null,
        openaiPlannerApiKeyMasked: openAiTok.masked,
        hasOpenaiPlannerApiKey: openAiTok.hasToken,
        cursorApiUrl: normalizeCursorApiBaseUrl(row.cursorApiUrl),
        cursorApiTokenMasked: curTok.masked,
        hasCursorToken: curTok.hasToken,
        workspacePath: "",
        allowedPathGlobs: Array.isArray(row.allowedPathGlobs) ? (row.allowedPathGlobs as string[]) : [],
        autoCommit: row.autoCommit,
        autoPush: row.autoPush,
        autoPr: row.autoPr,
        requireApprovalBeforeApply: row.requireApprovalBeforeApply,
        requireTestsBeforePush: row.requireTestsBeforePush,
        dryRunAllowed: row.dryRunAllowed,
        autoAdvanceToNextTask: row.autoAdvanceToNextTask !== false,
        maxAutoRetriesPerTask: typeof row.maxAutoRetriesPerTask === "number" ? row.maxAutoRetriesPerTask : 2,
        stopOnTestFailure: row.stopOnTestFailure !== false,
        stopOnRepeatedFailure: row.stopOnRepeatedFailure !== false,
        stopOnOutOfScopeChange: row.stopOnOutOfScopeChange !== false,
        requireApprovalForSensitiveTasks: row.requireApprovalForSensitiveTasks === true,
        status: row.status,
        lastValidatedAt: row.lastValidatedAt ? row.lastValidatedAt.toISOString() : null,
        needsRevalidation: Boolean(row.needsRevalidation),
        lastValidationError: row.lastValidationError ?? null,
        repoConnectionOk: row.repoConnectionOk ?? null,
        repoValidatedAt: row.repoValidatedAt ? row.repoValidatedAt.toISOString() : null,
        repoValidationError: row.repoValidationError ?? null,
        cursorApiConnectionOk: row.cursorApiConnectionOk ?? null,
        cursorApiValidatedAt: row.cursorApiValidatedAt ? row.cursorApiValidatedAt.toISOString() : null,
        cursorApiValidationError: row.cursorApiValidationError ?? null,
        executorConnectionOk: row.executorConnectionOk ?? null,
        executorValidatedAt: row.executorValidatedAt ? row.executorValidatedAt.toISOString() : null,
        executorValidationError: row.executorValidationError ?? null,
        updatedAt: row.updatedAt.toISOString(),
        peerCredentialHints,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    if (isExecutionSetupSchemaDriftError(error)) {
      return executionSetupSchemaDriftResponse();
    }
    console.error("GET /api/projects/[projectId]/execution-setup error:", error);
    return NextResponse.json({ success: false, message: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(
        pid,
        userId,
        "canEditProject",
        "PATCH /api/projects/[projectId]/execution-setup"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    let body: PatchBody = {};
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      return NextResponse.json({ success: false, message: "요청 본문이 올바른 JSON이 아닙니다." }, { status: 400 });
    }

    if (body.gitRepoUrl !== undefined) {
      const url = String(body.gitRepoUrl ?? "").trim();
      if (url && !isLikelyUrl(url)) {
        return NextResponse.json({ success: false, message: "저장소 URL이 올바른 http(s) 주소 형식이 아닙니다." }, { status: 400 });
      }
    }
    if (body.gitRepoProvider !== undefined) {
      const p = String(body.gitRepoProvider ?? "").trim().toLowerCase();
      if (p && p !== "github" && p !== "other") {
        return NextResponse.json(
          { success: false, message: "호스팅 제공자는 github 또는 other 만 허용됩니다." },
          { status: 400 }
        );
      }
    }

    if (body.cursorApiUrl !== undefined) {
      const u = String(body.cursorApiUrl ?? "").trim();
      if (u && !isLikelyUrl(u)) {
        return NextResponse.json(
          { success: false, message: "Cursor API URL이 올바른 http(s) 주소 형식이 아닙니다." },
          { status: 400 }
        );
      }
    }

    const maxRetriesIn = toIntOrUndefined(body.maxAutoRetriesPerTask);
    if (maxRetriesIn !== undefined && (maxRetriesIn < 0 || maxRetriesIn > 20)) {
      return NextResponse.json(
        { success: false, message: "maxAutoRetriesPerTask는 0~20 사이여야 합니다." },
        { status: 400 }
      );
    }

    const globsIn = toStringArrayOrUndefined(body.allowedPathGlobs);

    const data: Record<string, unknown> = {
      ...(body.gitRepoUrl !== undefined ? { gitRepoUrl: String(body.gitRepoUrl ?? "").trim() } : {}),
      ...(body.gitRepoProvider !== undefined
        ? {
            gitRepoProvider: String(body.gitRepoProvider ?? "").trim().toLowerCase() || "github",
          }
        : {}),
      ...(body.gitRepoName !== undefined ? { gitRepoName: normalizeGitRepoNameForDb(body.gitRepoName) } : {}),
      ...(body.baseBranch !== undefined ? { baseBranch: String(body.baseBranch ?? "").trim() } : {}),
      ...(body.branchStrategy !== undefined ? { branchStrategy: body.branchStrategy } : {}),
      ...(body.branchPrefix !== undefined ? { branchPrefix: toStringOrNull(body.branchPrefix) } : {}),

      ...(globsIn !== undefined ? { allowedPathGlobs: globsIn } : {}),

      ...(toBoolOrUndefined(body.autoCommit) !== undefined ? { autoCommit: Boolean(body.autoCommit) } : {}),
      ...(toBoolOrUndefined(body.autoPush) !== undefined ? { autoPush: Boolean(body.autoPush) } : {}),
      ...(toBoolOrUndefined(body.autoPr) !== undefined ? { autoPr: Boolean(body.autoPr) } : {}),
      ...(toBoolOrUndefined(body.requireApprovalBeforeApply) !== undefined
        ? { requireApprovalBeforeApply: Boolean(body.requireApprovalBeforeApply) }
        : {}),
      ...(toBoolOrUndefined(body.requireTestsBeforePush) !== undefined
        ? { requireTestsBeforePush: Boolean(body.requireTestsBeforePush) }
        : {}),
      ...(toBoolOrUndefined(body.dryRunAllowed) !== undefined ? { dryRunAllowed: Boolean(body.dryRunAllowed) } : {}),
      ...(toBoolOrUndefined(body.autoAdvanceToNextTask) !== undefined
        ? { autoAdvanceToNextTask: Boolean(body.autoAdvanceToNextTask) }
        : {}),
      ...(maxRetriesIn !== undefined ? { maxAutoRetriesPerTask: maxRetriesIn } : {}),
      ...(toBoolOrUndefined(body.stopOnTestFailure) !== undefined
        ? { stopOnTestFailure: Boolean(body.stopOnTestFailure) }
        : {}),
      ...(toBoolOrUndefined(body.stopOnRepeatedFailure) !== undefined
        ? { stopOnRepeatedFailure: Boolean(body.stopOnRepeatedFailure) }
        : {}),
      ...(toBoolOrUndefined(body.stopOnOutOfScopeChange) !== undefined
        ? { stopOnOutOfScopeChange: Boolean(body.stopOnOutOfScopeChange) }
        : {}),
      ...(toBoolOrUndefined(body.requireApprovalForSensitiveTasks) !== undefined
        ? { requireApprovalForSensitiveTasks: Boolean(body.requireApprovalForSensitiveTasks) }
        : {}),

      ...(body.cursorApiUrl !== undefined
        ? {
            cursorApiUrl: normalizeCursorApiBaseUrl(
              String(body.cursorApiUrl ?? "").trim() || DEFAULT_CURSOR_API_BASE
            ),
          }
        : {}),
      ...(body.cursorApiToken !== undefined
        ? (() => {
            const raw = body.cursorApiToken;
            if (raw === null || raw === "") {
              return { cursorApiToken: null, cursorApiTokenMasked: null };
            }
            const tok = String(raw).trim();
            return {
              cursorApiToken: tok,
              cursorApiTokenMasked: maskCursorTokenForUi(tok),
            };
          })()
        : {}),
      ...(body.githubAccessToken !== undefined
        ? (() => {
            const raw = body.githubAccessToken;
            if (raw === null || raw === "") {
              return { githubAccessToken: null, githubAccessTokenMasked: null };
            }
            const tok = sanitizeGithubPatForStorage(String(raw));
            if (!tok) {
              return { githubAccessToken: null, githubAccessTokenMasked: null };
            }
            return {
              githubAccessToken: tok,
              githubAccessTokenMasked: maskGithubTokenForUi(tok),
            };
          })()
        : {}),
      ...(body.openaiPlannerApiKey !== undefined
        ? (() => {
            const raw = body.openaiPlannerApiKey;
            if (raw === null || raw === "") {
              return { openaiPlannerApiKey: null, openaiPlannerApiKeyMasked: null };
            }
            const tok = String(raw).trim();
            return {
              openaiPlannerApiKey: tok,
              openaiPlannerApiKeyMasked: maskOpenAiKeyForUi(tok),
            };
          })()
        : {}),
    };

    const existing = await withExecutionSetupSchemaHealRetry(() =>
      prisma.executionSetup.findUnique({ where: { projectId: pid } })
    );

    const nextGitRepoUrl =
      body.gitRepoUrl !== undefined ? String(body.gitRepoUrl ?? "").trim() : (existing?.gitRepoUrl ?? "");
    const nextBaseBranch =
      body.baseBranch !== undefined ? String(body.baseBranch ?? "").trim() : (existing?.baseBranch ?? "");
    const nextGitRepoProvider =
      body.gitRepoProvider !== undefined
        ? String(body.gitRepoProvider ?? "").trim().toLowerCase() || "github"
        : String(existing?.gitRepoProvider ?? "github")
            .trim()
            .toLowerCase() || "github";
    const nextGitRepoName =
      body.gitRepoName !== undefined ? normalizeGitRepoNameForDb(body.gitRepoName) : (existing?.gitRepoName ?? null);
    const nextBranchStrategy =
      body.branchStrategy !== undefined ? body.branchStrategy : (existing?.branchStrategy ?? "manual");
    const nextBranchPrefix =
      body.branchPrefix !== undefined ? toStringOrNull(body.branchPrefix) : (existing?.branchPrefix ?? null);
    const globsDirty =
      Boolean(existing) &&
      globsIn !== undefined &&
      normalizeGlobsJson(globsIn) !== normalizeGlobsJson(existing?.allowedPathGlobs);

    const cursorDirty = Boolean(
      existing && (body.cursorApiUrl !== undefined || body.cursorApiToken !== undefined)
    );
    const githubDirty = Boolean(existing && body.githubAccessToken !== undefined);

    const repoDirty = Boolean(
      existing &&
        (nextGitRepoUrl !== String(existing.gitRepoUrl ?? "").trim() ||
          nextBaseBranch !== String(existing.baseBranch ?? "").trim() ||
          nextGitRepoProvider !== String(existing.gitRepoProvider ?? "github").trim().toLowerCase() ||
          String(nextGitRepoName ?? "") !== String(existing.gitRepoName ?? "") ||
          nextBranchStrategy !== existing.branchStrategy ||
          String(nextBranchPrefix ?? "") !== String(existing.branchPrefix ?? ""))
    );
    const executorDirty = Boolean(existing && globsDirty);

    if (repoDirty) {
      data.repoConnectionOk = null;
      data.repoValidatedAt = null;
      data.repoValidationError = null;
      data.executorConnectionOk = null;
      data.executorValidatedAt = null;
      data.executorValidationError = null;
      data.githubCapabilityValidation = Prisma.DbNull;
    }
    if (executorDirty || cursorDirty) {
      data.cursorApiConnectionOk = null;
      data.cursorApiValidatedAt = null;
      data.cursorApiValidationError = null;
      data.executorConnectionOk = null;
      data.executorValidatedAt = null;
      data.executorValidationError = null;
    }
    if (githubDirty) {
      data.githubAuthConnectionOk = null;
      data.githubAuthValidatedAt = null;
      data.githubAuthValidationError = null;
      data.githubCapabilityValidation = Prisma.DbNull;
    }
    if (repoDirty || executorDirty || cursorDirty || githubDirty) {
      const mergeRepoOk = repoDirty ? null : (existing?.repoConnectionOk ?? null);
      const mergeGithubOk = githubDirty ? null : (existing?.githubAuthConnectionOk ?? null);
      const mergeCursorApiOk = executorDirty || cursorDirty ? null : (existing?.cursorApiConnectionOk ?? null);
      const mergeExecOk = executorDirty || cursorDirty ? null : (existing?.executorConnectionOk ?? null);
      data.status = executionSetupOverallStatus(mergeRepoOk, mergeGithubOk, mergeCursorApiOk, mergeExecOk);
      data.needsRevalidation = true;
      data.lastValidationError = null;
    }

    const defaults = {
      projectId: pid,
      gitRepoUrl: "",
      gitRepoProvider: "github",
      gitRepoName: null,
      baseBranch: "main",
      branchStrategy: "manual",
      branchPrefix: null,
      githubAccessToken: null,
      githubAccessTokenMasked: null,
      openaiPlannerApiKey: null,
      openaiPlannerApiKeyMasked: null,
      githubAuthConnectionOk: null,
      githubAuthValidatedAt: null,
      githubAuthValidationError: null,
      cursorApiUrl: DEFAULT_CURSOR_API_BASE,
      cursorApiToken: null,
      cursorApiTokenMasked: null,
      workspacePath: "",
      projectRootPath: "",
      repoValidationCommands: [],
      allowedPathGlobs: [],
      autoCommit: true,
      autoPush: false,
      autoPr: false,
      requireApprovalBeforeApply: true,
      requireTestsBeforePush: true,
      dryRunAllowed: true,
      autoAdvanceToNextTask: true,
      maxAutoRetriesPerTask: 2,
      stopOnTestFailure: true,
      stopOnRepeatedFailure: true,
      stopOnOutOfScopeChange: true,
      requireApprovalForSensitiveTasks: false,
      status: "draft",
      lastValidatedAt: null,
      needsRevalidation: false,
      lastValidationError: null,
      repoConnectionOk: null,
      repoValidatedAt: null,
      repoValidationError: null,
      cursorApiConnectionOk: null,
      cursorApiValidatedAt: null,
      cursorApiValidationError: null,
      executorConnectionOk: null,
      executorValidatedAt: null,
      executorValidationError: null,
    } as const;

    const row = await withExecutionSetupSchemaHealRetry(() =>
      prisma.executionSetup.upsert({
        where: { projectId: pid },
        create: {
          ...defaults,
          ...data,
        },
        update: data,
      })
    );

    let githubPatPostSaveCheck: GithubPatPostSaveRepoProbeResult | undefined;
    if (body.githubAccessToken !== undefined) {
      const prevTok = sanitizeGithubPatForStorage(String(existing?.githubAccessToken ?? ""));
      const prevFp = prevTok ? githubTokenFingerprint(prevTok) : "(none)";
      const prevPx = prevTok ? githubTokenPrefixForLog(prevTok) : "—";
      const storedTok = sanitizeGithubPatForStorage(String(row.githubAccessToken ?? ""));
      const storedFp = storedTok ? githubTokenFingerprint(storedTok) : "(cleared)";
      const storedPx = storedTok ? githubTokenPrefixForLog(storedTok) : "—";
      const expectedClear = body.githubAccessToken === null || body.githubAccessToken === "";
      const expectedTok = expectedClear ? "" : sanitizeGithubPatForStorage(String(body.githubAccessToken));
      const dbMatches =
        expectedClear ? storedTok === "" : storedTok === expectedTok && storedTok.length > 0;
      const fingerprintChanged = !expectedClear && prevFp !== "(none)" && storedFp !== "(cleared)" && prevFp !== storedFp;
      const fingerprintUnchanged = !expectedClear && prevFp === storedFp && prevTok.length > 0;
      console.info(
        `[GitHub token] PATCH execution-setup projectId=${pid} DB_OVERWRITE ` +
          `TOKEN_SOURCE=DB prev_TOKEN_PREFIX=${prevPx} new_TOKEN_PREFIX=${storedPx} ` +
          `prev_TOKEN_LENGTH=${prevTok.length} new_TOKEN_LENGTH=${storedTok.length} ` +
          `prev_TOKEN_HASH=${prevFp} new_TOKEN_HASH=${storedFp} ` +
          `fingerprint_changed=${fingerprintChanged} fingerprint_unchanged=${fingerprintUnchanged} ` +
          `db_row_matches_sanitized_request=${dbMatches}`
      );

      if (storedTok && !expectedClear) {
        const probeGitRepoUrl =
          String(nextGitRepoUrl ?? "").trim() ||
          String(row.gitRepoUrl ?? "").trim() ||
          String(existing?.gitRepoUrl ?? "").trim();
        if (!probeGitRepoUrl) {
          githubPatPostSaveCheck = {
            attempted: false,
            skippedReason: "missing_git_repo_url",
            httpStatus: null,
            xAcceptedGitHubPermissions: null,
            ok: false,
          };
        } else {
        githubPatPostSaveCheck = await probeGithubPatAgainstExecutionRepo({
          gitRepoUrl: probeGitRepoUrl,
          token: storedTok,
          projectId: pid,
        });
        }
        const reread = await withExecutionSetupSchemaHealRetry(() =>
          prisma.executionSetup.findUnique({
            where: { projectId: pid },
            select: { githubAccessToken: true },
          })
        );
        const rereadTok = sanitizeGithubPatForStorage(String(reread?.githubAccessToken ?? ""));
        const rereadFp = rereadTok ? githubTokenFingerprint(rereadTok) : "(cleared)";
        console.info(
          `[GitHub token] PATCH execution-setup projectId=${pid} DB_REREAD_AFTER_UPSERT ` +
            `TOKEN_SOURCE=DB TOKEN_LENGTH=${rereadTok.length} TOKEN_HASH=${rereadFp} ` +
            `matches_upsert_row_hash=${rereadFp === storedFp}`
        );
      } else {
        githubPatPostSaveCheck = {
          attempted: false,
          skippedReason: "token_cleared_or_empty_after_sanitize",
          httpStatus: null,
          xAcceptedGitHubPermissions: null,
          ok: false,
        };
      }
    }

    const ghTokPatch = clientGithubTokenMeta(row);
    const curTokPatch = clientCursorTokenMeta(row);
    const openAiTokPatch = clientOpenAiPlannerKeyMeta(row);

    let peerCredentialHintsPatch: {
      githubAccessTokenMasked: string | null;
      cursorApiUrl: string | null;
      cursorApiTokenMasked: string | null;
    } | null = null;
    const projectMetaPatch = await prisma.project.findUnique({
      where: { id: pid },
      select: { ownerUserId: true },
    });
    if (projectMetaPatch?.ownerUserId) {
      const donor = await getUserDefaultExecutionCredentials(projectMetaPatch.ownerUserId, pid);
      if (donor) {
        const needsGh = !ghTokPatch.hasToken;
        const needsCur = !curTokPatch.hasToken;
        const gh = needsGh ? donor.githubAccessTokenMasked : null;
        const cu = needsCur ? donor.cursorApiUrl : null;
        const ctm = needsCur ? donor.cursorApiTokenMasked : null;
        if (gh || ctm) {
          peerCredentialHintsPatch = {
            githubAccessTokenMasked: gh,
            cursorApiUrl: cu,
            cursorApiTokenMasked: ctm,
          };
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Execution setup을 저장했습니다.",
      ...(githubPatPostSaveCheck !== undefined ? { githubPatPostSaveCheck } : {}),
      data: {
        id: row.id,
        projectId: row.projectId,
        gitRepoUrl: row.gitRepoUrl,
        gitRepoProvider: row.gitRepoProvider ?? "github",
        gitRepoName: row.gitRepoName,
        baseBranch: row.baseBranch,
        branchStrategy: row.branchStrategy,
        branchPrefix: row.branchPrefix,
        githubAccessTokenMasked: ghTokPatch.masked,
        hasGithubAccessToken: ghTokPatch.hasToken,
        githubAuthConnectionOk: row.githubAuthConnectionOk ?? null,
        githubAuthValidatedAt: row.githubAuthValidatedAt ? row.githubAuthValidatedAt.toISOString() : null,
        githubAuthValidationError: row.githubAuthValidationError ?? null,
        githubCapabilityValidation: row.githubCapabilityValidation ?? null,
        openaiPlannerApiKeyMasked: openAiTokPatch.masked,
        hasOpenaiPlannerApiKey: openAiTokPatch.hasToken,
        cursorApiUrl: normalizeCursorApiBaseUrl(row.cursorApiUrl),
        cursorApiTokenMasked: curTokPatch.masked,
        hasCursorToken: curTokPatch.hasToken,
        workspacePath: "",
        allowedPathGlobs: Array.isArray(row.allowedPathGlobs) ? (row.allowedPathGlobs as string[]) : [],
        autoCommit: row.autoCommit,
        autoPush: row.autoPush,
        autoPr: row.autoPr,
        requireApprovalBeforeApply: row.requireApprovalBeforeApply,
        requireTestsBeforePush: row.requireTestsBeforePush,
        dryRunAllowed: row.dryRunAllowed,
        autoAdvanceToNextTask: row.autoAdvanceToNextTask !== false,
        maxAutoRetriesPerTask: typeof row.maxAutoRetriesPerTask === "number" ? row.maxAutoRetriesPerTask : 2,
        stopOnTestFailure: row.stopOnTestFailure !== false,
        stopOnRepeatedFailure: row.stopOnRepeatedFailure !== false,
        stopOnOutOfScopeChange: row.stopOnOutOfScopeChange !== false,
        requireApprovalForSensitiveTasks: row.requireApprovalForSensitiveTasks === true,
        status: row.status,
        lastValidatedAt: row.lastValidatedAt ? row.lastValidatedAt.toISOString() : null,
        needsRevalidation: Boolean(row.needsRevalidation),
        lastValidationError: row.lastValidationError ?? null,
        repoConnectionOk: row.repoConnectionOk ?? null,
        repoValidatedAt: row.repoValidatedAt ? row.repoValidatedAt.toISOString() : null,
        repoValidationError: row.repoValidationError ?? null,
        cursorApiConnectionOk: row.cursorApiConnectionOk ?? null,
        cursorApiValidatedAt: row.cursorApiValidatedAt ? row.cursorApiValidatedAt.toISOString() : null,
        cursorApiValidationError: row.cursorApiValidationError ?? null,
        executorConnectionOk: row.executorConnectionOk ?? null,
        executorValidatedAt: row.executorValidatedAt ? row.executorValidatedAt.toISOString() : null,
        executorValidationError: row.executorValidationError ?? null,
        updatedAt: row.updatedAt.toISOString(),
        peerCredentialHints: peerCredentialHintsPatch,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    if (isExecutionSetupSchemaDriftError(error)) {
      return executionSetupSchemaDriftResponse();
    }
    console.error("PATCH /api/projects/[projectId]/execution-setup error:", error);
    return NextResponse.json({ success: false, message: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

