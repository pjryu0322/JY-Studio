/**
 * Stage 8-B control bundle item builders (read-only).
 */

import {
  STAGE8_B_CONTROL_ITEM_SPECS,
  STAGE8_B_REQUIRED_CONTROL_ITEM_IDS,
} from "@/lib/agents/runtimeControlBundleConstants";
import { isSourceReadyForControlItems } from "@/lib/agents/runtimeControlBundleItemSource";
import type { RuntimeExecutionVerticalSliceReport } from "@/lib/agents/runtimeExecutionVerticalSliceTypes";
import type { RuntimeControlBundleItem } from "@/lib/agents/runtimeControlBundleTypes";

export function buildRuntimeControlBundleItems(
  source: RuntimeExecutionVerticalSliceReport,
): readonly RuntimeControlBundleItem[] {
  if (!isSourceReadyForControlItems(source)) {
    return [];
  }

  return STAGE8_B_REQUIRED_CONTROL_ITEM_IDS.map((itemId) => {
    const spec = STAGE8_B_CONTROL_ITEM_SPECS[itemId];
    return {
      itemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      source: spec.source,
      designOnly: true as const,
      implementedInThisStep: false as const,
      stage9Candidate: spec.stage9Candidate,
      requiredBeforeStage9: spec.requiredBeforeStage9,
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      requiredApprovals: [...spec.requiredApprovals],
    };
  });
}
