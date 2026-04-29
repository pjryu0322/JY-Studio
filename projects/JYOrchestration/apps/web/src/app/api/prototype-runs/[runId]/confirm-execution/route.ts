import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { confirmPrototypeWorkUnitsExecution, refreshPrototypeRunState } from "@/lib/prototype/prototypeRunPipeline";
import { getRun } from "@/lib/prototype/prototypeRunStore";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

export async function POST(request: NextRequest, segmentData: { params: Promise<{ runId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const { runId } = await segmentData.params;
  const id = String(runId ?? "").trim();
  if (!id) return NextResponse.json({ success: false, message: "runId가 필요합니다." }, { status: 400 });

  let body: { projectId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const projectId = String(body.projectId ?? "").trim();
  if (!projectId) return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/prototype-runs/[runId]/confirm-execution");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const existing = getRun(projectId, id);
  if (!existing) return NextResponse.json({ success: false, message: "해당 실행을 찾을 수 없습니다." }, { status: 404 });

  confirmPrototypeWorkUnitsExecution(projectId, id);
  const run = await refreshPrototypeRunState(projectId, id);
  return NextResponse.json({
    success: true,
    data: { run: run ?? getRun(projectId, id) },
    message: "WorkUnit 실행을 시작합니다.",
  });
}
