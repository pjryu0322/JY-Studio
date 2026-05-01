import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import {
  confirmPrototypeWorkUnitsExecution,
  evaluatePrototypeCursorAutomation,
  orchestrateNewPrototypeRun,
  refreshPrototypeRunState,
} from "@/lib/prototype/prototypeRunPipeline";
import { getRun, updateRun } from "@/lib/prototype/prototypeRunStore";
import { logPrototypePipelineEvent } from "@/lib/prototype/prototypeRunLog";
import { prisma } from "@/lib/prisma";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

type Mode = "resume" | "restart";

function isResumeAllowed(runStatus: string): boolean {
  return (
    runStatus === "CANCELLED" ||
    runStatus === "FAILED" ||
    runStatus === "WORK_UNITS_READY" ||
    runStatus === "PROMPT_READY" ||
    runStatus === "CURSOR_REQUESTED" ||
    runStatus === "CURSOR_RUNNING" ||
    runStatus === "COMMIT_DETECTED" ||
    runStatus === "PUSH_CONFIRMED" ||
    runStatus === "AI_REVIEWING" ||
    runStatus === "REWORK_REQUIRED" ||
    runStatus === "PR_OPENED" ||
    runStatus === "MERGED"
  );
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
      /** restart는 작업계획(WorkUnit) 재생성이 목적. 자동화 가능하면 실행 확인까지 서버에서 이어감. */
      startCursorAgent: false,
      /** 이미 실행 중이어도 새 run을 강제로 생성 */
      forceNewRun: true,
      plannerActorUserId: userId,
    });
    logPrototypePipelineEvent("prototype_restarted", { projectId, oldRunId: id, runId: out.run.id });

    let finalRun = out.run;
    const gate = await evaluatePrototypeCursorAutomation(projectId);
    if (
      gate.automationAvailable &&
      (finalRun.workUnits?.length ?? 0) > 0 &&
      finalRun.status === "WORK_UNITS_READY"
    ) {
      confirmPrototypeWorkUnitsExecution(projectId, finalRun.id);
      finalRun = (await refreshPrototypeRunState(projectId, finalRun.id)) ?? getRun(projectId, finalRun.id) ?? finalRun;
    }

    const message =
      gate.automationAvailable && (out.run.workUnits?.length ?? 0) > 0 && out.run.status === "WORK_UNITS_READY"
        ? "새 실행으로 다시 시작했습니다. 자동 실행이 가능해 WorkUnit 실행을 시작했습니다."
        : "새 실행으로 다시 시작합니다.";

    return NextResponse.json({ success: true, data: { run: finalRun }, message });
  }

  logPrototypePipelineEvent("prototype_resume_requested", { projectId, runId: id });

  if (!isResumeAllowed(run.status)) {
    return NextResponse.json({ success: false, message: "재개할 수 없는 상태입니다.", data: { run } }, { status: 409 });
  }

  const hasWorkUnits = (run.workUnits?.length ?? 0) > 0;
  const nextStatus = hasWorkUnits ? "WORK_UNITS_READY" : "PROMPT_READY";
  let patched =
    updateRun(projectId, id, {
      status: nextStatus,
      statusReason: null,
      cancelRequestedAt: null,
      cancelReason: null,
    }) ?? run;

  patched = (await refreshPrototypeRunState(projectId, id)) ?? patched;
  logPrototypePipelineEvent("prototype_resumed", { projectId, runId: id });

  return NextResponse.json({ success: true, data: { run: patched }, message: "이전 작업부터 다시 진행합니다." });
}

