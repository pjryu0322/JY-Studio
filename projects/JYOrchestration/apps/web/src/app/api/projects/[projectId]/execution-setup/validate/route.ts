import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";

const executionSetupRepo = (prisma as unknown as typeof prisma & { executionSetup: any }).executionSetup;

function isLikelyUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type ValidateResult = {
  ok: boolean;
  git: "ok" | "needs" | "error";
  cursor: "ok" | "needs" | "error";
  messages: string[];
};

function validateRow(row: {
  gitRepoUrl: string;
  baseBranch: string;
  cursorApiUrl: string;
  cursorApiToken: string | null;
  workspacePath: string;
  projectRootPath: string;
}): ValidateResult {
  const messages: string[] = [];

  let git: ValidateResult["git"] = "ok";
  if (!row.gitRepoUrl.trim() || !isLikelyUrl(row.gitRepoUrl.trim())) {
    git = row.gitRepoUrl.trim() ? "error" : "needs";
    messages.push("Git: Repository URL을 확인하세요.");
  }
  if (!row.baseBranch.trim()) {
    git = "error";
    messages.push("Git: Base branch가 필요합니다.");
  }

  let cursor: ValidateResult["cursor"] = "ok";
  if (!row.cursorApiUrl.trim() || !isLikelyUrl(row.cursorApiUrl.trim())) {
    cursor = row.cursorApiUrl.trim() ? "error" : "needs";
    messages.push("Cursor: Executor URL을 확인하세요.");
  }
  if (!row.cursorApiToken?.trim()) {
    cursor = cursor === "error" ? "error" : "needs";
    messages.push("Cursor: API 토큰이 필요합니다.");
  }
  if (!row.workspacePath.trim()) {
    cursor = "error";
    messages.push("Cursor: workspace path가 필요합니다.");
  }
  if (!row.projectRootPath.trim()) {
    cursor = "error";
    messages.push("Cursor: project root path가 필요합니다.");
  }
  if (row.workspacePath.trim() && row.projectRootPath.trim()) {
    const ws = row.workspacePath.replace(/\\/g, "/").replace(/\/+$/, "");
    const root = row.projectRootPath.replace(/\\/g, "/").replace(/\/+$/, "");
    if (!root.startsWith(ws)) {
      cursor = "error";
      messages.push("Cursor: project root path는 workspace path 하위여야 합니다.");
    }
  }

  const ok = git !== "error" && cursor !== "error" && git !== "needs" && cursor !== "needs";
  return { ok, git, cursor, messages };
}

export async function POST(
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
        "POST /api/projects/[projectId]/execution-setup/validate"
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const row = await executionSetupRepo.findUnique({ where: { projectId: pid } });
    if (!row) {
      return NextResponse.json(
        { success: false, message: "저장된 Execution setup이 없습니다. 먼저 설정을 저장하세요." },
        { status: 400 }
      );
    }

    const v = validateRow({
      gitRepoUrl: row.gitRepoUrl,
      baseBranch: row.baseBranch,
      cursorApiUrl: row.cursorApiUrl,
      cursorApiToken: row.cursorApiToken,
      workspacePath: row.workspacePath,
      projectRootPath: row.projectRootPath,
    });

    const nextStatus = v.ok ? "validated" : "invalid";
    const updated = await executionSetupRepo.update({
      where: { projectId: pid },
      data: {
        status: nextStatus,
        lastValidatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: v.ok ? "연결이 확인되었습니다." : "연결에 문제가 있습니다.",
      data: {
        status: updated.status,
        lastValidatedAt: updated.lastValidatedAt ? updated.lastValidatedAt.toISOString() : null,
        git: v.git,
        cursor: v.cursor,
        messages: v.messages,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/projects/[projectId]/execution-setup/validate error:", error);
    return NextResponse.json({ success: false, message: "연결 테스트 중 오류가 발생했습니다." }, { status: 500 });
  }
}

