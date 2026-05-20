/**
 * Clarification orchestration — pending questions resolved as follow-up, not new routes.
 */

import { getQuickActionDefinition, type QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import type {
  IntentClarificationWire,
  RequirementsIntentOrchestrationV1,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";
import { resolveQuickActionIdFromLegacyLabel } from "@/lib/requirements/requirementsQuickActionRegistry";

export function buildClarificationPendingState(input: {
  readonly question: string;
  readonly topic?: IntentClarificationWire["topic"];
  readonly candidateActionIds?: readonly QuickActionId[];
  readonly nowIso?: string;
}): IntentClarificationWire {
  return {
    pending: true,
    topic: input.topic ?? "action_choice",
    question: input.question.slice(0, 500),
    candidateActionIds: input.candidateActionIds?.slice(0, 8),
    askedAt: input.nowIso ?? new Date().toISOString(),
  };
}

export function clearClarificationState(): IntentClarificationWire {
  return { pending: false };
}

export function tryResolveClarification(input: {
  readonly userMessage: string;
  readonly clarification: IntentClarificationWire | undefined;
  readonly availableActionIds: readonly QuickActionId[];
}): IntentRoutingResult | null {
  if (!input.clarification?.pending) return null;
  const msg = String(input.userMessage ?? "").trim();
  if (!msg) return null;

  const fromLabel = resolveQuickActionIdFromLegacyLabel(msg);
  if (fromLabel && input.availableActionIds.includes(fromLabel)) {
    return {
      intentType: "orchestration_action",
      suggestedActionId: fromLabel,
      confidence: 0.88,
      reason: "clarification resolution via action label",
      routerMode: "deterministic",
    };
  }

  const candidates = input.clarification.candidateActionIds ?? [];
  for (const id of candidates) {
    const label = getQuickActionDefinition(id).defaultLabel.toLowerCase();
    if (msg.toLowerCase().includes(label)) {
      return {
        intentType: "orchestration_action",
        suggestedActionId: id,
        confidence: 0.85,
        reason: "clarification resolution via candidate chip",
        routerMode: "deterministic",
      };
    }
  }

  if (/기능|수정|편집/.test(msg) && input.availableActionIds.includes("EDIT_FEATURES")) {
    return {
      intentType: "edit_request",
      suggestedActionId: "EDIT_FEATURES",
      confidence: 0.8,
      reason: "clarification resolution feature edit",
      routerMode: "deterministic",
    };
  }
  if (/화면/.test(msg) && input.availableActionIds.includes("DEFINE_SCREEN")) {
    return {
      intentType: "orchestration_action",
      suggestedActionId: "DEFINE_SCREEN",
      confidence: 0.8,
      reason: "clarification resolution screen define",
      routerMode: "deterministic",
    };
  }
  if (/api/.test(msg) && input.availableActionIds.includes("DEFINE_API")) {
    return {
      intentType: "orchestration_action",
      suggestedActionId: "DEFINE_API",
      confidence: 0.8,
      reason: "clarification resolution api define",
      routerMode: "deterministic",
    };
  }

  return null;
}

export function shouldTreatAsClarificationResolution(
  orch: RequirementsIntentOrchestrationV1 | null | undefined,
): boolean {
  return orch?.clarification?.pending === true;
}
