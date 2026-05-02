import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { refreshPrototypeRunState } from "@/lib/prototype/prototypeRunPipeline";
import { getRun } from "@/lib/prototype/prototypeRunStore";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { PrototypeRun } from "@/lib/prototype/prototypeRunTypes";

type NextAction =
  | "WAIT_CURSOR"
  | "WAIT_GITHUB_PUSH"
  | "REVIEWING"
  | "OPEN_PR"
  | "MERGED"
  | "CONNECT_PREVIEW_URL"
  | "REWORK_REQUIRED"
  | "FAILED"
  | "BLOCKED";

function computeNextAction(run: PrototypeRun): { nextAction: NextAction; userMessage: string | null } {
  switch (run.status) {
    case "PROMPT_READY":
    case "PLANNER_ANALYZING":
    case "WORK_UNITS_READY":
      if (
        run.runSchemaVersion >= 2 &&
        run.workUnits.length > 0 &&
        run.workUnitsExecutionConfirmed !== true
      ) {
        return {
          nextAction: "WAIT_CURSOR",
          userMessage: "WorkUnit 미리보기 단계입니다. 실행을 확정하면 Cursor가 시작됩니다.",
        };
      }
      return { nextAction: "WAIT_CURSOR", userMessage: "Cursor 실행을 기다리는 중입니다." };
    case "CURSOR_REQUESTED":
    case "CURSOR_RUNNING":
      return { nextAction: "WAIT_CURSOR", userMessage: "Cursor 실행을 기다리는 중입니다." };
    case "COMMIT_DETECTED":
      return { nextAction: "WAIT_GITHUB_PUSH", userMessage: "원격 푸시 반영을 확인하는 중입니다." };
    case "PUSH_CONFIRMED":
      return { nextAction: "REVIEWING", userMessage: "AI 검토를 진행합니다." };
    case "AI_REVIEWING":
      return { nextAction: "REVIEWING", userMessage: "AI 검토를 진행합니다." };
    case "REWORK_REQUIRED":
      return { nextAction: "REWORK_REQUIRED", userMessage: run.aiReviewSummary ?? "보완이 필요합니다." };
    case "PR_OPENED":
      return run.previewUrl
        ? { nextAction: "CONNECT_PREVIEW_URL", userMessage: "결과 URL이 연결되어 있습니다." }
        : { nextAction: "CONNECT_PREVIEW_URL", userMessage: "소스 생성은 완료되었습니다. 결과 URL을 연결하세요." };
    case "MERGED":
      return { nextAction: "MERGED", userMessage: "GitHub Pages 배포 설정을 시작합니다." };
    case "DEPLOY_CONFIGURING":
      return { nextAction: "MERGED", userMessage: "Pages 배포 워크플로를 저장소에 반영하는 중입니다." };
    case "DEPLOYING":
      return { nextAction: "MERGED", userMessage: "GitHub Actions Pages 배포를 기다리는 중입니다." };
    case "DEPLOY_FAILED":
      return { nextAction: "FAILED", userMessage: run.deployFailureDetail ?? "배포에 실패했습니다." };
    case "PREVIEW_READY":
      return {
        nextAction: "CONNECT_PREVIEW_URL",
        userMessage: run.publicUrl
          ? "정식 배포 URL이 준비되었습니다."
          : "프로토타입 초안이 생성되었습니다. 검토 화면에서 Preview를 확인하세요.",
      };
    case "FAILED":
      return { nextAction: "FAILED", userMessage: run.aiReviewSummary ?? "실행이 실패했습니다." };
    case "BLOCKED":
      return { nextAction: "BLOCKED", userMessage: "자동화가 중단되었습니다. 설정/승인을 확인하세요." };
    default:
      return { nextAction: "WAIT_CURSOR", userMessage: null };
  }
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ runId: string }> },
) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const { runId } = await segmentData.params;
  const id = String(runId ?? "").trim();
  if (!id) {
    return NextResponse.json({ success: false, message: "runId가 필요합니다." }, { status: 400 });
  }

  let body: { projectId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  if (!projectId) {
    return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-runs/[runId]/refresh");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const existing = getRun(projectId, id);
  if (!existing) {
    return NextResponse.json({ success: false, message: "해당 실행을 찾을 수 없습니다." }, { status: 404 });
  }

  const run = await refreshPrototypeRunState(projectId, id);
  const resolved = run ?? existing;
  const a = computeNextAction(resolved);
  return NextResponse.json({ success: true, data: { run: resolved, ...a } });
}
