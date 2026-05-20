/**
 * Persist intent orchestration focus when UI selects a feature (drawer/canvas), not from chat text.
 */

import {
  buildCurrentEditingTargetForFeature,
  buildFeatureEditingFocus,
} from "@/lib/requirements/requirementsConversationFocus";
import {
  mergeIntentOrchestrationPatch,
  type RequirementsIntentOrchestrationV1,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";

export function buildIntentOrchestrationFocusPatch(input: {
  readonly featureId: string;
  readonly label?: string;
  readonly prev?: RequirementsIntentOrchestrationV1 | null;
  readonly nowIso?: string;
}): RequirementsIntentOrchestrationV1 {
  return mergeIntentOrchestrationPatch(input.prev, {
    activeFocus: buildFeatureEditingFocus({ featureId: input.featureId, label: input.label }),
    currentEditingTarget: buildCurrentEditingTargetForFeature(input.featureId),
  }, input.nowIso);
}
