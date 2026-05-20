import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "@/lib/auth/requireSession";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { rbacErrorResponse } from "@/lib/rbac/handleApiRbac";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import { isQuickActionId, type QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import { routeRequirementsIntentAsync } from "@/lib/requirements/requirementsIntentRouter";
import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationConversationMemory } from "@/lib/requirements/requirementsConversationMemory";
import type { RequirementsIntentRouterInput } from "@/lib/requirements/requirementsIntentRouterTypes";
import type { IntentClarificationWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";

type Body = {
  projectId?: string;
  projectName?: string;
  projectDescription?: string;
  userMessage?: string;
  authoritativeStage?: OrchestrationStage;
  availableActionIds?: string[];
  chatVisibleActionIds?: string[];
  conversationState?: string | null;
  featureMetrics?: FeatureDetailProjectionMetrics;
  conversationMemory?: OrchestrationConversationMemory;
  clarification?: IntentClarificationWire;
};

function parseActionIds(raw: unknown): QuickActionId[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? "").trim()).filter((id): id is QuickActionId => isQuickActionId(id));
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireSessionUserId(request);
    if (userId instanceof NextResponse) return userId;

    const body = (await request.json()) as Body;
    const projectId = String(body.projectId ?? "").trim();
    const userMessage = String(body.userMessage ?? "").trim();
    if (!projectId) {
      return NextResponse.json({ success: false, message: "projectId가 필요합니다." }, { status: 400 });
    }
    if (!userMessage) {
      return NextResponse.json({ success: false, message: "userMessage가 필요합니다." }, { status: 400 });
    }

    try {
      await requireProjectPermission(projectId, userId, "canViewProject", "POST /api/requirements/intent-router");
    } catch (error) {
      const denied = rbacErrorResponse(error);
      if (denied) return denied;
      throw error;
    }

    const availableActionIds = parseActionIds(body.availableActionIds);
    const chatVisibleActionIds = parseActionIds(body.chatVisibleActionIds);
    const authoritativeStage = String(body.authoritativeStage ?? "SERVICE_FLOW").trim() as OrchestrationStage;
    const featureMetrics = body.featureMetrics ?? {
      featureCount: 0,
      confirmedFeatureCount: 0,
      candidateFeatureCount: 0,
      partialFeatureCount: 0,
      featureCoverage: 0,
      hasCandidateFeature: false,
      hasConfirmedFeature: false,
      canEnterScreenDefine: false,
    };

    const routerInput: RequirementsIntentRouterInput = {
      userMessage,
      authoritativeStage,
      availableActionIds,
      chatVisibleActionIds,
      projection: {
        authoritativeStage,
        quickActions: [],
        featureDetail: featureMetrics,
        conversationState: (body.conversationState as RequirementsIntentRouterInput["projection"]["conversationState"]) ?? null,
      },
      featureMetrics,
      projectName: String(body.projectName ?? "").trim(),
      projectDescription: String(body.projectDescription ?? "").trim(),
      conversationMemory: body.conversationMemory,
    };

    const intent = await routeRequirementsIntentAsync(routerInput, {
      clarification: body.clarification,
    });
    return NextResponse.json({ success: true, data: { intent } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
