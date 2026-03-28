import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import {
  assertProjectRootPathOrThrow,
  PROJECT_ROOT_PATH_ERROR,
} from "@/lib/executionSetup/hardening";

const executionSetupRepo = (prisma as unknown as typeof prisma & { executionSetup: any }).executionSetup;

function maskToken(token: string): string {
  const t = token.trim();
  if (!t) return "";
  if (t.length <= 8) return "********";
  const head = t.slice(0, 4);
  const tail = t.slice(-2);
  return `${head}${"*".repeat(Math.min(32, t.length - 6))}${tail}`;
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
  gitRepoName: string | null;
  baseBranch: string;
  branchStrategy: "feature-per-workflow" | "feature-per-task" | "manual";
  branchPrefix: string | null;

  cursorApiUrl: string;
  cursorApiToken: string | null;
  workspacePath: string;
  projectRootPath: string;

  autoCommit: boolean;
  autoPush: boolean;
  autoPr: boolean;
  requireApprovalBeforeApply: boolean;
  requireTestsBeforePush: boolean;
  dryRunAllowed: boolean;
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

    const row = await executionSetupRepo.findUnique({ where: { projectId: pid } });
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
        gitRepoName: row.gitRepoName,
        baseBranch: row.baseBranch,
        branchStrategy: row.branchStrategy,
        branchPrefix: row.branchPrefix,
        cursorApiUrl: row.cursorApiUrl,
        cursorApiTokenMasked: row.cursorApiTokenMasked,
        hasCursorToken: Boolean(row.cursorApiToken && row.cursorApiToken.trim()),
        workspacePath: row.workspacePath,
        projectRootPath: row.projectRootPath,
        autoCommit: row.autoCommit,
        autoPush: row.autoPush,
        autoPr: row.autoPr,
        requireApprovalBeforeApply: row.requireApprovalBeforeApply,
        requireTestsBeforePush: row.requireTestsBeforePush,
        dryRunAllowed: row.dryRunAllowed,
        status: row.status,
        lastValidatedAt: row.lastValidatedAt ? row.lastValidatedAt.toISOString() : null,
        needsRevalidation: Boolean(row.needsRevalidation),
        lastValidationError: row.lastValidationError ?? null,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
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

    const tokenIn = body.cursorApiToken !== undefined ? toStringOrNull(body.cursorApiToken) : undefined;
    if (body.cursorApiUrl !== undefined) {
      const url = String(body.cursorApiUrl ?? "").trim();
      if (url && !isLikelyUrl(url)) {
        return NextResponse.json({ success: false, message: "Cursor API URL이 올바른 URL 형식이 아닙니다." }, { status: 400 });
      }
    }
    if (body.gitRepoUrl !== undefined) {
      const url = String(body.gitRepoUrl ?? "").trim();
      if (url && !isLikelyUrl(url)) {
        return NextResponse.json({ success: false, message: "Repo URL이 올바른 URL 형식이 아닙니다." }, { status: 400 });
      }
    }

    const data: Record<string, unknown> = {
      ...(body.gitRepoUrl !== undefined ? { gitRepoUrl: String(body.gitRepoUrl ?? "").trim() } : {}),
      ...(body.gitRepoName !== undefined ? { gitRepoName: toStringOrNull(body.gitRepoName) } : {}),
      ...(body.baseBranch !== undefined ? { baseBranch: String(body.baseBranch ?? "").trim() } : {}),
      ...(body.branchStrategy !== undefined ? { branchStrategy: body.branchStrategy } : {}),
      ...(body.branchPrefix !== undefined ? { branchPrefix: toStringOrNull(body.branchPrefix) } : {}),

      ...(body.cursorApiUrl !== undefined ? { cursorApiUrl: String(body.cursorApiUrl ?? "").trim() } : {}),
      ...(body.workspacePath !== undefined ? { workspacePath: String(body.workspacePath ?? "").trim() } : {}),
      ...(body.projectRootPath !== undefined ? { projectRootPath: String(body.projectRootPath ?? "").trim() } : {}),

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
    };

    if (tokenIn !== undefined) {
      data.cursorApiToken = tokenIn;
      data.cursorApiTokenMasked = tokenIn ? maskToken(tokenIn) : null;
    }

    const existing = await executionSetupRepo.findUnique({ where: { projectId: pid } });

    const nextWorkspace =
      body.workspacePath !== undefined ? String(body.workspacePath ?? "").trim() : (existing?.workspacePath ?? "");
    const nextProjectRoot =
      body.projectRootPath !== undefined
        ? String(body.projectRootPath ?? "").trim()
        : (existing?.projectRootPath ?? "");
    try {
      assertProjectRootPathOrThrow(nextProjectRoot, nextWorkspace, pid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === PROJECT_ROOT_PATH_ERROR) {
        return NextResponse.json({ success: false, message: PROJECT_ROOT_PATH_ERROR }, { status: 400 });
      }
      throw e;
    }

    const nextGitRepoUrl =
      body.gitRepoUrl !== undefined ? String(body.gitRepoUrl ?? "").trim() : (existing?.gitRepoUrl ?? "");
    const nextBaseBranch =
      body.baseBranch !== undefined ? String(body.baseBranch ?? "").trim() : (existing?.baseBranch ?? "");
    const nextCursorUrl =
      body.cursorApiUrl !== undefined ? String(body.cursorApiUrl ?? "").trim() : (existing?.cursorApiUrl ?? "");
    const nextToken = tokenIn !== undefined ? tokenIn : (existing?.cursorApiToken ?? null);
    const tokenNorm = (t: string | null) => (t && String(t).trim() ? String(t).trim() : null);
    const sensitivityChanged = Boolean(
      existing &&
        (nextGitRepoUrl !== (existing.gitRepoUrl ?? "") ||
          nextBaseBranch !== (existing.baseBranch ?? "") ||
          nextWorkspace !== (existing.workspacePath ?? "") ||
          nextProjectRoot !== (existing.projectRootPath ?? "") ||
          nextCursorUrl !== (existing.cursorApiUrl ?? "") ||
          tokenNorm(nextToken) !== tokenNorm(existing.cursorApiToken ?? null))
    );
    if (sensitivityChanged) {
      data.status = "draft";
      data.needsRevalidation = true;
      data.lastValidationError = null;
    }

    const defaults = {
      projectId: pid,
      gitRepoUrl: "",
      gitRepoName: null,
      baseBranch: "main",
      branchStrategy: "manual",
      branchPrefix: null,
      cursorApiUrl: "",
      cursorApiToken: null,
      cursorApiTokenMasked: null,
      workspacePath: "",
      projectRootPath: "",
      autoCommit: true,
      autoPush: false,
      autoPr: false,
      requireApprovalBeforeApply: true,
      requireTestsBeforePush: true,
      dryRunAllowed: true,
      status: "draft",
      lastValidatedAt: null,
      needsRevalidation: false,
      lastValidationError: null,
    } as const;

    const row = await executionSetupRepo.upsert({
      where: { projectId: pid },
      create: {
        ...defaults,
        ...data,
      },
      update: data,
    });

    return NextResponse.json({
      success: true,
      message: "Execution setup을 저장했습니다.",
      data: {
        id: row.id,
        projectId: row.projectId,
        gitRepoUrl: row.gitRepoUrl,
        gitRepoName: row.gitRepoName,
        baseBranch: row.baseBranch,
        branchStrategy: row.branchStrategy,
        branchPrefix: row.branchPrefix,
        cursorApiUrl: row.cursorApiUrl,
        cursorApiTokenMasked: row.cursorApiTokenMasked,
        hasCursorToken: Boolean(row.cursorApiToken && row.cursorApiToken.trim()),
        workspacePath: row.workspacePath,
        projectRootPath: row.projectRootPath,
        autoCommit: row.autoCommit,
        autoPush: row.autoPush,
        autoPr: row.autoPr,
        requireApprovalBeforeApply: row.requireApprovalBeforeApply,
        requireTestsBeforePush: row.requireTestsBeforePush,
        dryRunAllowed: row.dryRunAllowed,
        status: row.status,
        lastValidatedAt: row.lastValidatedAt ? row.lastValidatedAt.toISOString() : null,
        needsRevalidation: Boolean(row.needsRevalidation),
        lastValidationError: row.lastValidationError ?? null,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("PATCH /api/projects/[projectId]/execution-setup error:", error);
    return NextResponse.json({ success: false, message: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}

