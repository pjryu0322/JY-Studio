import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { buildImplementationExecutionSummaryCounts } from "@/lib/prototype/implementationExecutionSummary";
import { toImplementationRuntimeSnapshotApiSummary } from "@/lib/prototype/implementationRuntimeSnapshot";
import { parseImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { parseCodeTaskExecutionRunsV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { parseImplementationPreviewRuntimeV1 } from "@/lib/prototype/implementationPreviewRuntimeV1";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const projectId = String(request.nextUrl.searchParams.get("projectId") ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(
        projectId,
        userId,
        "canViewProject",
        "GET /api/prototype/implementation/summary",
      );
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const row = await prisma.project.findUnique({
      where: { id: projectId },
      select: { requirementsStateJson: true },
    });
    const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
    const codeTaskPlan = parseImplementationCodeTaskPlanV1(state.implementationCodeTaskPlanV1) ?? null;
    const runs = parseCodeTaskExecutionRunsV1(state.codeTaskExecutionRunsV1) ?? [];
    const previewRuntime = parseImplementationPreviewRuntimeV1(state.implementationPreviewRuntimeV1) ?? null;

    const summary = buildImplementationExecutionSummaryCounts({
      projectId,
      requirementsState: state,
      codeTaskPlan,
      runs,
      previewRuntime,
    });

    return NextResponse.json({
      success: true,
      snapshot: toImplementationRuntimeSnapshotApiSummary(summary.runtimeSnapshot),
      diagnostics: summary.runtimeSnapshot.diagnostics,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
