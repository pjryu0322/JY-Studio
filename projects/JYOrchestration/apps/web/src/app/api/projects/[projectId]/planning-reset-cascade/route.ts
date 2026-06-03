import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  resetProjectDownstreamFromPlanning,
  type PlanningResetCascadeReason,
} from "@/lib/requirements/planningResetCascadeService";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const { projectId } = await context.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(pid, userId, "canEditProject", "POST planning-reset-cascade");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const reason = String(body.reason ?? "planning_reset").trim() as PlanningResetCascadeReason;
    const allowed: PlanningResetCascadeReason[] = [
      "planning_reset",
      "planning_regenerated",
      "manual",
    ];
    const resolvedReason = allowed.includes(reason) ? reason : "planning_reset";

    const result = await resetProjectDownstreamFromPlanning({
      projectId: pid,
      reason: resolvedReason,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
