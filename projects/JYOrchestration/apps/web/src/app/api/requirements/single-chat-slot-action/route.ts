import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import { conversationScopeFromProjectId, isProjectSingleChatScope } from "@/lib/conversation/conversationScopeBoundary";
import { executeSingleChatSlotAction } from "@/lib/requirements/singleChatPlanningSlotProposal";
import { routeSingleChatSlotAction } from "@/lib/requirements/singleChatSlotActionRouter";
import { isSingleChatSlotActionWire } from "@/lib/requirements/singleChatSlotActionTypes";
import {
  buildDynamicServicePlanningSlotDefinitions,
  hashSlotDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { parseRequirementsSingleChatOrchestrationV1 } from "@/lib/requirements/singleChatOrchestrationStateWire";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { buildSingleChatPromptTimelineEntry } from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  userMessage?: string;
  slotAction?: unknown;
  singleChatOrchestrationV1?: unknown;
  currentFlow?: unknown;
  recentMessages?: string;
};

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const projectName = String(body.projectName ?? "").trim();
    const projectDescription = String(body.projectDescription ?? "").trim();
    const userMessage = String(body.userMessage ?? "").trim();

    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }
    if (!isProjectSingleChatScope(conversationScopeFromProjectId(projectId))) {
      return NextResponse.json(
        { success: false, message: "slot action은 Project SingleChat에서만 실행할 수 있습니다." },
        { status: 400 },
      );
    }

    const slotActionRaw = body.slotAction;
    if (!isSingleChatSlotActionWire(slotActionRaw)) {
      return NextResponse.json({ success: false, message: "slotAction이 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/single-chat-slot-action");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const slotDefinitions = buildDynamicServicePlanningSlotDefinitions({
      projectName,
      projectDescription,
      projectType: null,
      servicePlanningAgentCatalogKeys: null,
    });
    const orchParsed = parseRequirementsSingleChatOrchestrationV1(body.singleChatOrchestrationV1, slotDefinitions);
    const orchestration =
      orchParsed && orchParsed.slotDefinitionsHash === hashSlotDefinitions(slotDefinitions) ? orchParsed : null;

    const route = routeSingleChatSlotAction({
      executionScope: conversationScopeFromProjectId(projectId),
      slotAction: slotActionRaw,
      quickActionLabel: slotActionRaw.label,
      userMessage,
      orchestration,
      definitions: slotDefinitions,
    });
    if (!route.shouldRunSlotAction || !route.slotAction) {
      return NextResponse.json(
        { success: false, message: "slot action을 라우팅할 수 없습니다." },
        { status: 400 },
      );
    }

    const currentFlow = (body.currentFlow ?? null) as RequirementsServiceFlowV1 | null;
    const result = executeSingleChatSlotAction({
      slotAction: route.slotAction,
      projectName,
      projectDescription,
      orchestration,
      definitions: slotDefinitions,
      flow: currentFlow,
      recentMessages: String(body.recentMessages ?? "").trim(),
    });

    const promptTrace = buildSingleChatPromptTimelineEntry({
      action: "singleChatSlotAction",
      source: "internal",
      timelineStage: "service-flow",
      stageGroup: "service-planning",
      workspaceScreenKey: "requirements_service_flow",
      selectedAgents: [],
      promptText: `[slot-action] ${route.slotActionId}\nexecutionScope=project_single_chat`,
      responseText: result.assistantMessage.slice(0, 4000),
      routingDecision: route.reason,
      createdAtIso: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: {
        assistantMessage: result.assistantMessage,
        quickReplies: [...result.quickReplies],
        slotDecision: result.slotDecision,
      },
      meta: {
        promptTrace,
        requirementsStatePatch: { singleChatOrchestrationV1: result.orchestration },
      },
    });
  } catch (error) {
    const denied = rbacErrorResponse(error);
    if (denied) return denied;
    console.error("POST /api/requirements/single-chat-slot-action error:", error);
    return NextResponse.json({ success: false, message: "slot action 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
