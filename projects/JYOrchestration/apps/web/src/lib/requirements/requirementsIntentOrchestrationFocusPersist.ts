/**
 * Persist intent orchestration focus when UI selects a feature (drawer/canvas), not from chat text.
 */

import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
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
  readonly state?: RequirementsStateJson;
  readonly nowIso?: string;
}): RequirementsIntentOrchestrationV1 {
  const stage = input.state ? resolveAuthoritativeOrchestrationStage(input.state) : "FEATURE_DETAIL";
  return mergeIntentOrchestrationPatch(input.prev, {
    activeFocus: buildFeatureEditingFocus({
      featureId: input.featureId,
      label: input.label,
      stage,
      nowIso: input.nowIso,
    }),
    currentEditingTarget: buildCurrentEditingTargetForFeature(input.featureId),
  }, input.nowIso);
}
