/**
 * Focus drift detection — soft stale without silent removal.
 */

import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import {
  ORCHESTRATION_ALTERNATE_FOCUS_STALE_HITS,
  ORCHESTRATION_FOCUS_STALE_TURNS,
} from "@/lib/requirements/requirementsOrchestrationConstants";
import type {
  ConversationFocusWire,
  RequirementsIntentOrchestrationV1,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";

export function touchConversationFocus(input: {
  readonly focus: ConversationFocusWire;
  readonly nowIso: string;
  readonly stage: OrchestrationStage;
  readonly referenced?: boolean;
}): ConversationFocusWire {
  const referenced = input.referenced !== false;
  const prevCount = input.focus.referenceCount ?? 0;
  return {
    ...input.focus,
    confidence: Math.min(1, (input.focus.confidence ?? 0.72) + (referenced ? 0.06 : 0)),
    lastReferencedAt: referenced ? input.nowIso : input.focus.lastReferencedAt,
    referenceCount: referenced ? prevCount + 1 : prevCount,
    focusSetAtStage: input.focus.focusSetAtStage ?? input.stage,
    softStale: false,
  };
}

export function detectFocusSoftStale(input: {
  readonly orch: RequirementsIntentOrchestrationV1;
  readonly currentStage: OrchestrationStage;
  readonly inferredFocusId?: string | null;
}): boolean {
  const focus = input.orch.activeFocus;
  if (!focus?.id) return false;

  const turnCount = input.orch.turnCount ?? 0;
  const lastTurn = input.orch.lastFocusReferencedTurn ?? turnCount;
  const turnsSinceRef = Math.max(0, turnCount - lastTurn);
  if (turnsSinceRef >= ORCHESTRATION_FOCUS_STALE_TURNS) return true;

  const altHits = input.orch.alternateFocusHits ?? 0;
  if (altHits >= ORCHESTRATION_ALTERNATE_FOCUS_STALE_HITS) return true;

  if (focus.focusSetAtStage && focus.focusSetAtStage !== input.currentStage) return true;

  if (
    input.inferredFocusId &&
    input.inferredFocusId !== focus.id &&
    input.inferredFocusId !== input.orch.currentEditingTarget?.featureId
  ) {
    return true;
  }

  return false;
}

export function applyFocusDriftToOrchestration(input: {
  readonly orch: RequirementsIntentOrchestrationV1;
  readonly currentStage: OrchestrationStage;
  readonly nextFocus?: ConversationFocusWire;
  readonly referencedFocus?: boolean;
  readonly inferredFocusId?: string | null;
  readonly nowIso: string;
}): RequirementsIntentOrchestrationV1 {
  const turnCount = (input.orch.turnCount ?? 0) + 1;
  let alternateFocusHits = input.orch.alternateFocusHits ?? 0;
  let activeFocus = input.orch.activeFocus;

  if (input.nextFocus) {
    if (activeFocus?.id && input.nextFocus.id !== activeFocus.id) {
      alternateFocusHits += 1;
    }
    activeFocus = touchConversationFocus({
      focus: input.nextFocus,
      nowIso: input.nowIso,
      stage: input.currentStage,
      referenced: input.referencedFocus,
    });
  } else if (activeFocus && input.referencedFocus) {
    activeFocus = touchConversationFocus({
      focus: activeFocus,
      nowIso: input.nowIso,
      stage: input.currentStage,
      referenced: true,
    });
  }

  const softStale = activeFocus
    ? detectFocusSoftStale({
        orch: { ...input.orch, turnCount, alternateFocusHits, activeFocus },
        currentStage: input.currentStage,
        inferredFocusId: input.inferredFocusId,
      })
    : false;

  if (activeFocus && softStale) {
    activeFocus = { ...activeFocus, softStale: true };
  }

  const lastFocusReferencedTurn =
    input.referencedFocus || input.nextFocus ? turnCount : input.orch.lastFocusReferencedTurn;

  return {
    ...input.orch,
    turnCount,
    alternateFocusHits,
    activeFocus,
    lastFocusReferencedTurn,
  };
}
