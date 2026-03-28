import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import { probeCursorExecutor, probeGitHttpRemote } from "@/lib/executionSetup/hardening";

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
  probeGitOk?: boolean;
  probeCursorOk?: boolean;
};

function validateStructure(row: {
  gitRepoUrl: string;
  baseBranch: string;
  cursorApiUrl: string;
  cursorApiToken: string | null;
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

    const v = validateStructure({
      gitRepoUrl: row.gitRepoUrl,
      baseBranch: row.baseBranch,
      cursorApiUrl: row.cursorApiUrl,
      cursorApiToken: row.cursorApiToken,
    });

    let probeGitOk = false;
    let probeCursorOk = false;
    const probeMessages: string[] = [];

    if (v.ok) {
      const [gitProbe, cursorProbe] = await Promise.all([
        probeGitHttpRemote(row.gitRepoUrl.trim()),
        probeCursorExecutor(row.cursorApiUrl.trim(), row.cursorApiToken),
      ]);
      probeGitOk = gitProbe.ok;
      probeCursorOk = cursorProbe.ok;
      if (!gitProbe.ok) {
        probeMessages.push(`Git: 원격 저장소에 연결할 수 없습니다. (${gitProbe.error ?? "unknown"})`);
      }
      if (!cursorProbe.ok) {
        probeMessages.push(`Cursor: Executor에 연결할 수 없습니다. (${cursorProbe.error ?? "unknown"})`);
      }
    }

    const probesPass = v.ok && probeGitOk && probeCursorOk;
    const nextStatus = probesPass ? "validated" : "invalid";
    const summaryError = !v.ok ? v.messages.join(" · ") : probeMessages.length ? probeMessages.join(" · ") : null;

    const updated = await executionSetupRepo.update({
      where: { projectId: pid },
      data: {
        status: nextStatus,
        lastValidatedAt: new Date(),
        needsRevalidation: false,
        lastValidationError: probesPass ? null : summaryError,
      },
    });

    const allMessages = [...v.messages, ...probeMessages];
    const userMessage = probesPass
      ? "연결 및 구성 검증에 성공했습니다."
      : !v.ok
        ? "구성 검증에 실패했습니다."
        : "원격 연결 검증에 실패했습니다.";

    return NextResponse.json({
      success: true,
      message: userMessage,
      data: {
        status: updated.status,
        lastValidatedAt: updated.lastValidatedAt ? updated.lastValidatedAt.toISOString() : null,
        needsRevalidation: Boolean(updated.needsRevalidation),
        lastValidationError: updated.lastValidationError ?? null,
        git: v.git,
        cursor: v.cursor,
        messages: allMessages,
        probeGitOk: v.ok ? probeGitOk : undefined,
        probeCursorOk: v.ok ? probeCursorOk : undefined,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/projects/[projectId]/execution-setup/validate error:", error);
    return NextResponse.json({ success: false, message: "연결 테스트 중 오류가 발생했습니다." }, { status: 500 });
  }
}
