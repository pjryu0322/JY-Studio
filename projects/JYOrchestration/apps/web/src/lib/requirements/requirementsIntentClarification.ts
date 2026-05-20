/**
 * Clarification orchestration — pending questions resolved as follow-up, not new routes.
 */

import type { FeatureDetailSlotsV1 } from "@/lib/requirements/featureDetailSlots";
import { getQuickActionDefinition, type QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import { resolveQuickActionIdFromLegacyLabel } from "@/lib/requirements/requirementsQuickActionRegistry";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import type {
  IntentClarificationWire,
  RequirementsIntentOrchestrationV1,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";

const AMBIGUOUS_EDIT_PATTERN = /(그거|그건|이거|이건|그것|이것).*(수정|편집|바꿔|고쳐)|(수정|편집|바꿔|고쳐).*(그거|그건|이거|이건)/;

export function isAmbiguousTargetEditRequest(
  userMessage: string,
  hasActiveFocus: boolean,
): boolean {
  if (hasActiveFocus) return false;
  const msg = String(userMessage ?? "").trim();
  if (!msg) return false;
  return AMBIGUOUS_EDIT_PATTERN.test(msg);
}

export function buildTargetResolutionClarification(input?: {
  readonly question?: string;
  readonly nowIso?: string;
}): IntentClarificationWire {
  return buildClarificationPendingState({
    topic: "target_resolution",
    question: input?.question ?? "어떤 항목을 수정할까요?",
    nowIso: input?.nowIso,
  });
}

function resolveFeatureIdFromMessage(
  msg: string,
  slots: FeatureDetailSlotsV1["slots"],
): string | null {
  const normalized = msg.trim().toLowerCase();
  for (const slot of slots) {
    const title = slot.title.trim().toLowerCase();
    if (title.length >= 2 && normalized.includes(title)) return slot.id;
    if (/업로드/.test(normalized) && /업로드/.test(title)) return slot.id;
    if (/녹취/.test(normalized) && /녹취/.test(title)) return slot.id;
  }
  return null;
}

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
  readonly featureDetailSlotsV1?: FeatureDetailSlotsV1 | null;
}): IntentRoutingResult | null {
  if (!input.clarification?.pending) return null;
  const msg = String(input.userMessage ?? "").trim();
  if (!msg) return null;

  const topic = input.clarification.topic;
  if (
    (topic === "target_resolution" || topic === "feature_target") &&
    input.featureDetailSlotsV1?.slots?.length
  ) {
    const featureId = resolveFeatureIdFromMessage(msg, input.featureDetailSlotsV1.slots);
    if (featureId && input.availableActionIds.includes("EDIT_FEATURES")) {
      return {
        intentType: "edit_request",
        suggestedActionId: "EDIT_FEATURES",
        confidence: 0.86,
        reason: "clarification resolution feature target",
        routerMode: "clarification_resolution",
        explainability: { routingReason: `resolvedFeature:${featureId}` },
        extractedTargets: { featureIds: [featureId] },
      };
    }
  }

  const fromLabel = resolveQuickActionIdFromLegacyLabel(msg);
  if (fromLabel && input.availableActionIds.includes(fromLabel)) {
    return {
      intentType: "orchestration_action",
      suggestedActionId: fromLabel,
      confidence: 0.88,
      reason: "clarification resolution via action label",
      routerMode: "clarification_resolution",
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
        routerMode: "clarification_resolution",
      };
    }
  }

  if (/기능|수정|편집/.test(msg) && input.availableActionIds.includes("EDIT_FEATURES")) {
    return {
      intentType: "edit_request",
      suggestedActionId: "EDIT_FEATURES",
      confidence: 0.8,
      reason: "clarification resolution feature edit",
      routerMode: "clarification_resolution",
    };
  }
  if (/화면/.test(msg) && input.availableActionIds.includes("DEFINE_SCREEN")) {
    return {
      intentType: "orchestration_action",
      suggestedActionId: "DEFINE_SCREEN",
      confidence: 0.8,
      reason: "clarification resolution screen define",
      routerMode: "clarification_resolution",
    };
  }
  if (/api/.test(msg) && input.availableActionIds.includes("DEFINE_API")) {
    return {
      intentType: "orchestration_action",
      suggestedActionId: "DEFINE_API",
      confidence: 0.8,
      reason: "clarification resolution api define",
      routerMode: "clarification_resolution",
    };
  }

  return null;
}

export function shouldTreatAsClarificationResolution(
  orch: RequirementsIntentOrchestrationV1 | null | undefined,
): boolean {
  return orch?.clarification?.pending === true;
}
