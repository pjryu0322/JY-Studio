import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import {
  loadPlanningDatabaseSettingsForProject,
  resolvePlanningPostgresPassword,
} from "@/lib/planning/planningDatabaseSettingsService";
import { parsePlanningDataSlotsV1 } from "@/lib/planning/planningDataSlotsV1";
import {
  provisionImplementationSampleStore,
  provisionReviewTestStore,
} from "@/lib/planning/provisionProjectStageDataStores";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { prisma } from "@/lib/prisma";

type RouteContext = { readonly params: Promise<{ projectId: string }> };

type ProvisionTarget = "implementation" | "review";

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
      await requireProjectPermissionById(pid, userId, "canEditProject", "POST planning/stage-data-store/provision");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const body = (await request.json().catch(() => ({}))) as { readonly target?: ProvisionTarget };
    const target: ProvisionTarget = body.target === "review" ? "review" : "implementation";
    const nowIso = new Date().toISOString();

    const project = await prisma.project.findUnique({
      where: { id: pid },
      select: { requirementsStateJson: true },
    });
    const state = parseRequirementsStateJson(project?.requirementsStateJson);
    const slots = parsePlanningDataSlotsV1(state.planningDataSlotsV1);
    const [settings, password] = await Promise.all([
      loadPlanningDatabaseSettingsForProject(pid),
      resolvePlanningPostgresPassword(pid),
    ]);

    const provision =
      target === "review"
        ? await provisionReviewTestStore({
            projectId: pid,
            planningDataSlotsV1: slots,
            settings,
            password,
            nowIso,
          })
        : await provisionImplementationSampleStore({
            projectId: pid,
            planningDataSlotsV1: slots,
            settings,
            password,
            nowIso,
          });

    if (provision.planningDataSlotsV1) {
      const nextState = mergeRequirementsStateJson(state, {
        planningDataSlotsV1: provision.planningDataSlotsV1,
        ...(provision.timelineEntry
          ? {
              promptTimeline: [...(state.promptTimeline ?? []), provision.timelineEntry],
            }
          : {}),
      });
      await prisma.project.update({
        where: { id: pid },
        data: { requirementsStateJson: nextState as object },
      });
    }

    return NextResponse.json({
      success: provision.ok,
      message: provision.message,
      data: {
        target,
        planningDataSlotsV1: provision.planningDataSlotsV1,
        timelineEntry: provision.timelineEntry,
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST planning/stage-data-store/provision error:", error);
    return NextResponse.json({ success: false, message: "저장소 생성 중 오류가 발생했습니다." }, { status: 500 });
  }
}
