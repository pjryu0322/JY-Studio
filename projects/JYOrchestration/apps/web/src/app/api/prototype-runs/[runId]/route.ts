import { NextRequest, NextResponse } from "next/server";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { evaluatePrototypeCursorAutomation } from "@/lib/prototype/prototypeRunPipeline";
import { getRun, getRunVersionMeta } from "@/lib/prototype/prototypeRunStore";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";

export async function GET(request: NextRequest, segmentData: { params: Promise<{ runId: string }> }) {
  const userId = await requireSessionUserId(request);
  if (userId instanceof NextResponse) return userId;

  const { runId } = await segmentData.params;
  const rid = String(runId ?? "").trim();
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() ?? "";
  if (!projectId || !rid) {
    return NextResponse.json({ success: false, message: "projectId와 runId가 필요합니다." }, { status: 400 });
  }

  try {
    await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/prototype-runs/[runId]");
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    throw error;
  }

  const gate = await evaluatePrototypeCursorAutomation(projectId);
  const run = getRun(projectId, rid);
  const versionMeta = run ? getRunVersionMeta(projectId, run.id) : null;

  return NextResponse.json({
    success: true,
    data: {
      run,
      runVersionNo: versionMeta?.versionNo ?? null,
      runTotalCount: versionMeta?.totalRuns ?? null,
      automationAvailable: gate.automationAvailable,
      automationBlockReason: gate.blockReason,
    },
  });
}
