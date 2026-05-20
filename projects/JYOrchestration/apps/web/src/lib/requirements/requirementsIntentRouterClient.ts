"use client";

import type { OrchestrationConversationMemory } from "@/lib/requirements/requirementsConversationMemory";
import type { FeatureDetailProjectionMetrics } from "@/lib/requirements/featureDetailSlots";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import type { IntentClarificationWire } from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { memorySummaryForRouterPayload } from "@/lib/requirements/requirementsConversationMemory";

export type PostRequirementsIntentRouterBody = Readonly<{
  readonly projectId: string;
  readonly projectName?: string;
  readonly projectDescription?: string;
  readonly userMessage: string;
  readonly authoritativeStage: OrchestrationStage;
  readonly availableActionIds: readonly QuickActionId[];
  readonly chatVisibleActionIds: readonly QuickActionId[];
  readonly conversationState?: string | null;
  readonly featureMetrics: FeatureDetailProjectionMetrics;
  readonly conversationMemory?: OrchestrationConversationMemory;
  readonly clarification?: IntentClarificationWire;
}>;

export async function postRequirementsIntentRouter(
  body: PostRequirementsIntentRouterBody,
): Promise<
  | Readonly<{ readonly ok: true; readonly intent: IntentRoutingResult }>
  | Readonly<{ readonly ok: false; readonly message: string }>
> {
  const res = await fetch("/api/requirements/intent-router", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      conversationMemory: body.conversationMemory
        ? memorySummaryForRouterPayload(body.conversationMemory)
        : undefined,
    }),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: { intent?: IntentRoutingResult };
    message?: string;
  };
  if (!res.ok || !json.success || !json.data?.intent) {
    return { ok: false, message: String(json.message ?? "Intent router failed") };
  }
  return { ok: true, intent: json.data.intent };
}
