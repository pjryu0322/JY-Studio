import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { getPrototypeDeployStatusSnapshot } from "@/lib/prototype/prototypeDeploySnapshot";
import { refreshPrototypeRunState, requestPrototypeGithubPagesDeploy } from "@/lib/prototype/prototypeRunPipeline";
import { getRun } from "@/lib/prototype/prototypeRunStore";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

/** 보안 통과 후에만 GitHub Pages 정식 배포(기존 PR·머지 경로)를 요청한다. */
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
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-runs/[runId]/deploy-proceed");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const existing = getRun(projectId, id);
  if (!existing) {
    return NextResponse.json({ success: false, message: "해당 실행을 찾을 수 없습니다." }, { status: 404 });
  }

  const requested = requestPrototypeGithubPagesDeploy(projectId, id);
  if (!requested) {
    return NextResponse.json(
      {
        success: false,
        message:
          "보안 통과 상태가 아니거나 merge SHA가 일치하지 않아 배포를 진행할 수 없습니다. 보안 재점검을 완료한 뒤 다시 시도하세요.",
      },
      { status: 409 },
    );
  }

  const run = (await refreshPrototypeRunState(projectId, id)) ?? getRun(projectId, id) ?? requested;
  const deploy = getPrototypeDeployStatusSnapshot(run);
  return NextResponse.json({ success: true, data: { run, deploy } });
}
