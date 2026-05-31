import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import {
  findLatestActiveTaskCursorJobSummary,
  listTaskCursorJobsForProject,
} from "@/lib/prototype/taskCursorExecutionJobRepository";
import { buildTaskCursorJobOrchestrationSlice } from "@/lib/prototype/taskCursorJobStateSync";
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
      await requireProjectPermission(projectId, userId, "canViewProject", "GET /api/prototype/task-cursor/jobs");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const [jobs, activeJob, project] = await Promise.all([
      listTaskCursorJobsForProject(projectId),
      findLatestActiveTaskCursorJobSummary(projectId),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { requirementsStateJson: true },
      }),
    ]);
    const state = parseRequirementsStateJson(project?.requirementsStateJson);
    return NextResponse.json({
      success: true,
      jobs,
      activeJob,
      orchestrationPatch: buildTaskCursorJobOrchestrationSlice(state),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
