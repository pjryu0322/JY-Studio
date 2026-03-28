import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import {
  executionSetupSchemaDriftResponse,
  isExecutionSetupSchemaDriftError,
} from "@/lib/prisma/executionSetupSchemaMismatch";
import { withExecutionSetupSchemaHealRetry } from "@/lib/prisma/executionSetupSplitColumnsHeal";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

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
}>;

function toStringOrNull(v: unknown): string | null {
  if (v === null) return null;
  const s = String(v ?? "").trim();
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

function executionSetupOverallStatus(repoOk: boolean | null, execOk: boolean | null): "draft" | "validated" | "invalid" {
  if (repoOk === true && execOk === true) return "validated";
  if (repoOk === false || execOk === false) return "invalid";
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
      return NextResponse.json({
        success: true,
        message: "Execution setup이 아직 없습니다.",
        data: null,
      });
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
        cursorApiUrl: "",
        cursorApiTokenMasked: null,
        hasCursorToken: false,
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
        executorConnectionOk: row.executorConnectionOk ?? null,
        executorValidatedAt: row.executorValidatedAt ? row.executorValidatedAt.toISOString() : null,
        executorValidationError: row.executorValidationError ?? null,
        updatedAt: row.updatedAt.toISOString(),
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
        return NextResponse.json({ success: false, message: "Repo URL이 올바른 URL 형식이 아닙니다." }, { status: 400 });
      }
    }
    if (body.gitRepoProvider !== undefined) {
      const p = String(body.gitRepoProvider ?? "").trim().toLowerCase();
      if (p && p !== "github" && p !== "other") {
        return NextResponse.json(
          { success: false, message: "gitRepoProvider는 github 또는 other 만 허용됩니다." },
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
      ...(body.gitRepoName !== undefined ? { gitRepoName: toStringOrNull(body.gitRepoName) } : {}),
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
      body.gitRepoName !== undefined ? toStringOrNull(body.gitRepoName) : (existing?.gitRepoName ?? null);
    const nextBranchStrategy =
      body.branchStrategy !== undefined ? body.branchStrategy : (existing?.branchStrategy ?? "manual");
    const nextBranchPrefix =
      body.branchPrefix !== undefined ? toStringOrNull(body.branchPrefix) : (existing?.branchPrefix ?? null);
    const globsDirty =
      Boolean(existing) &&
      globsIn !== undefined &&
      normalizeGlobsJson(globsIn) !== normalizeGlobsJson(existing?.allowedPathGlobs);

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
    }
    if (executorDirty) {
      data.executorConnectionOk = null;
      data.executorValidatedAt = null;
      data.executorValidationError = null;
    }
    if (repoDirty || executorDirty) {
      const mergeRepoOk = repoDirty ? null : (existing?.repoConnectionOk ?? null);
      const mergeExecOk = executorDirty ? null : (existing?.executorConnectionOk ?? null);
      data.status = executionSetupOverallStatus(mergeRepoOk, mergeExecOk);
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
      cursorApiUrl: "",
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

    return NextResponse.json({
      success: true,
      message: "Execution setup을 저장했습니다.",
      data: {
        id: row.id,
        projectId: row.projectId,
        gitRepoUrl: row.gitRepoUrl,
        gitRepoProvider: row.gitRepoProvider ?? "github",
        gitRepoName: row.gitRepoName,
        baseBranch: row.baseBranch,
        branchStrategy: row.branchStrategy,
        branchPrefix: row.branchPrefix,
        cursorApiUrl: "",
        cursorApiTokenMasked: null,
        hasCursorToken: false,
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
        executorConnectionOk: row.executorConnectionOk ?? null,
        executorValidatedAt: row.executorValidatedAt ? row.executorValidatedAt.toISOString() : null,
        executorValidationError: row.executorValidationError ?? null,
        updatedAt: row.updatedAt.toISOString(),
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

