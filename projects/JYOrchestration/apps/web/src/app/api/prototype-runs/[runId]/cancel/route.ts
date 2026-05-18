import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { getRun, updateRun } from "@/lib/prototype/prototypeRunStore";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";
import { cancelCursorAgent } from "@/lib/execution/cursorExecutionAdapter";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { prisma } from "@/lib/prisma";

function isTerminal(status: string): boolean {
  return status === "CANCELLED" || status === "FAILED" || status === "BLOCKED" || status === "PREVIEW_READY";
}

export async function POST(request: NextRequest, segmentData: { params: Promise<{ runId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const { runId } = await segmentData.params;
  const id = String(runId ?? "").trim();
  if (!id) return NextResponse.json({ success: false, message: "runId가 필요합니다." }, { status: 400 });

  let body: { projectId?: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  if (!projectId) return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-runs/[runId]/cancel");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const run = getRun(projectId, id);
  if (!run) return NextResponse.json({ success: false, message: "해당 실행을 찾을 수 없습니다." }, { status: 404 });

  // Idempotent
  if (run.status === "CANCEL_REQUESTED" || run.status === "CANCELLED") {
    return NextResponse.json({ success: true, data: { run } });
  }
  if (isTerminal(run.status)) {
    return NextResponse.json({ success: false, message: "이미 종료된 실행입니다.", data: { run } }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const patched =
    updateRun(projectId, id, {
      status: "CANCEL_REQUESTED",
      cancelRequestedAt: nowIso,
      cancelReason: (reason || "user requested").slice(0, 400),
    }) ?? run;
  logPrototypePipelineEvent("prototype_cancel_requested", { projectId, runId: id });

  // Best effort: request Cursor agent cancel if possible.
  try {
    if (patched.cursorRunId) {
      const setup = await prisma.executionSetup.findUnique({ where: { projectId }, select: { cursorApiUrl: true, cursorApiToken: true } });
      const cursorApiUrl = String(setup?.cursorApiUrl ?? "").trim();
      const cursorApiToken = String(setup?.cursorApiToken ?? "").trim();
      if (cursorApiUrl && cursorApiToken) {
        logPrototypePipelineEvent("prototype_cursor_cancel_requested", { projectId, runId: id, cursorRunId: patched.cursorRunId });
        await cancelCursorAgent({ cursorApiUrl, cursorApiToken, agentId: patched.cursorRunId });
      }
    }
  } catch {
    // ignore: cancellation request is best-effort only
  }

  return NextResponse.json({ success: true, data: { run: patched } });
}

