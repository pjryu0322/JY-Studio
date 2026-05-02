import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { getPrototypeDeployStatusSnapshot } from "@/lib/prototype/prototypeDeploySnapshot";
import { refreshPrototypeRunState } from "@/lib/prototype/prototypeRunPipeline";
import { getRun } from "@/lib/prototype/prototypeRunStore";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

export async function GET(request: NextRequest, segmentData: { params: Promise<{ runId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const { runId } = await segmentData.params;
  const rid = String(runId ?? "").trim();
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";

  if (!projectId || !rid) {
    return NextResponse.json({ success: false, message: "projectId와 runId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/prototype-runs/[runId]/deploy-status");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const existing = getRun(projectId, rid);
  if (!existing) {
    return NextResponse.json({ success: false, message: "해당 실행을 찾을 수 없습니다." }, { status: 404 });
  }

  const run = refresh ? (await refreshPrototypeRunState(projectId, rid)) ?? existing : getRun(projectId, rid) ?? existing;
  const deploy = getPrototypeDeployStatusSnapshot(run);
  return NextResponse.json({ success: true, data: { run, deploy } });
}
