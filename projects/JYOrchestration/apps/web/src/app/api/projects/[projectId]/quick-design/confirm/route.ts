import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import {
  runQuickDesignConfirmOnServer,
  type QuickDesignConfirmServerMode,
} from "@/lib/prototype/quickDesignConfirmServer";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { SingleChatOrchestrationSlotDefinition } from "@/lib/requirements/singleChatOrchestrationTypes";

export const maxDuration = 120;

type ConfirmBody = Readonly<{
  readonly mode?: QuickDesignConfirmServerMode;
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly requirementsStateJson?: unknown;
  readonly conversationMessages?: readonly RequirementsMessage[];
  readonly slotDefinitions?: readonly SingleChatOrchestrationSlotDefinition[];
  readonly sourceStage?: OrchestrationStage;
  readonly envOkOverride?: boolean;
  readonly serviceFlow?: unknown;
  readonly problemInterview?: unknown;
}>;

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await segmentData.params;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }

    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    try {
      await requireProjectPermissionById(pid, userId, "canEditProject", "POST quick-design/confirm");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const body = (await request.json()) as ConfirmBody;
    const mode: QuickDesignConfirmServerMode = body.mode === "planning" ? "planning" : "implementation";

    const result = await runQuickDesignConfirmOnServer({
      projectId: pid,
      actorUserId: userId,
      mode,
      projectName: String(body.projectName ?? "").trim() || "프로젝트",
      projectDescription: String(body.projectDescription ?? ""),
      requirementsStateJson: body.requirementsStateJson,
      conversationMessages: body.conversationMessages ?? [],
      slotDefinitions: body.slotDefinitions ?? [],
      sourceStage: body.sourceStage,
      envOkOverride: body.envOkOverride,
      serviceFlow: body.serviceFlow as never,
      problemInterview: body.problemInterview as never,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    if (result.mode === "implementation") {
      return NextResponse.json({
        success: true,
        message: result.result.flow.userFacingSummary,
        data: {
          mode: "implementation" as const,
          messages: result.result.messages,
          orchestrationPatch: result.result.orchestrationPatch,
          userFacingSummary: result.result.flow.userFacingSummary,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: result.flow.userFacingSummary,
      data: {
        mode: "planning" as const,
        statePatch: result.flow.statePatch,
        userFacingSummary: result.flow.userFacingSummary,
        timelineEntries: result.flow.timelineEntries,
        primaryArtifactId: result.flow.primaryArtifactId,
        messages: [result.flow.readyMessage],
      },
    });
  } catch (error) {
    console.error("POST /api/projects/[projectId]/quick-design/confirm error:", error);
    return NextResponse.json({ success: false, message: "Quick Design 확정 중 오류가 발생했습니다." }, { status: 500 });
  }
}
