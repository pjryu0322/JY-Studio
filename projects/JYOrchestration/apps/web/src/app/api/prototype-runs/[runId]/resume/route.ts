import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { orchestrateNewPrototypeRun, refreshPrototypeRunState } from "@/lib/prototype/prototypeRunPipeline";
import { getRun, updateRun } from "@/lib/prototype/prototypeRunStore";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";
import { prisma } from "@/lib/prisma";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

type Mode = "resume" | "restart";

function isRecoverable(runStatus: string): boolean {
  return runStatus === "CANCELLED" || runStatus === "CANCEL_REQUESTED" || runStatus === "FAILED" || runStatus === "BLOCKED";
}

export async function POST(request: NextRequest, segmentData: { params: Promise<{ runId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const { runId } = await segmentData.params;
  const id = String(runId ?? "").trim();
  if (!id) return NextResponse.json({ success: false, message: "runId가 필요합니다." }, { status: 400 });

  let body: { projectId?: string; mode?: Mode };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  const mode = (String(body.mode ?? "resume").trim() as Mode) || "resume";
  if (!projectId) return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
  if (mode !== "resume" && mode !== "restart") {
    return NextResponse.json({ success: false, message: "mode는 resume|restart 여야 합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-runs/[runId]/resume");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const run = getRun(projectId, id);
  if (!run) return NextResponse.json({ success: false, message: "해당 실행을 찾을 수 없습니다." }, { status: 404 });

  if (mode === "restart") {
    logPrototypePipelineEvent("prototype_restart_requested", { projectId, runId: id });
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
    if (!project) return NextResponse.json({ success: false, message: "프로젝트를 찾을 수 없습니다." }, { status: 404 });

    // MVP: latest design/context는 클라이언트가 promptSnapshot으로 전달한다고 가정.
    const out = await orchestrateNewPrototypeRun({
      projectId,
      projectName: project.name,
      selectedTemplate: run.selectedTemplate,
      promptSnapshot: run.promptSnapshot,
      startCursorAgent: true,
    });
    logPrototypePipelineEvent("prototype_restarted", { projectId, oldRunId: id, runId: out.run.id });
    return NextResponse.json({ success: true, data: { run: out.run } });
  }

  logPrototypePipelineEvent("prototype_resume_requested", { projectId, runId: id });

  // Guard: do not resume rework-required via "resume"
  if (run.status === "REWORK_REQUIRED") {
    return NextResponse.json({ success: true, data: { run }, message: "보완이 필요합니다. 보완 후 다시 시도하세요." });
  }

  // If not recoverable, just refresh (idempotent)
  if (!isRecoverable(run.status)) {
    const refreshed = await refreshPrototypeRunState(projectId, id);
    return NextResponse.json({ success: true, data: { run: refreshed ?? run } });
  }

  // Convert CANCEL_REQUESTED -> CANCELLED before resuming.
  let patched = run;
  if (patched.status === "CANCEL_REQUESTED") {
    patched = updateRun(projectId, id, { status: "CANCELLED" }) ?? patched;
  }

  // Resume from safe checkpoint without creating duplicate cursor runs
  if (patched.commitSha) {
    patched = updateRun(projectId, id, { status: "COMMIT_DETECTED" }) ?? patched;
  } else if (patched.cursorRunId) {
    patched = updateRun(projectId, id, { status: "CURSOR_RUNNING" }) ?? patched;
  } else {
    patched = updateRun(projectId, id, { status: "TASK_PACKAGES_READY" }) ?? patched;
  }

  patched = (await refreshPrototypeRunState(projectId, id)) ?? patched;
  logPrototypePipelineEvent("prototype_resumed", { projectId, runId: id });

  return NextResponse.json({ success: true, data: { run: patched } });
}

