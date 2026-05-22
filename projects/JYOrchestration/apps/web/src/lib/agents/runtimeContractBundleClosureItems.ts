/**
 * Stage 7-C contract bundle item builders (read-only).
 */

import {
  STAGE7_C_BUNDLE_ITEM_SPECS,
  STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS,
} from "@/lib/agents/runtimeContractBundleClosureConstants";
import { isSourceReadyForBundleItems } from "@/lib/agents/runtimeContractBundleClosureItemSource";
import type { RuntimeApiContractDesignReport } from "@/lib/agents/runtimeApiContractDesignTypes";
import type { RuntimeContractBundleItem } from "@/lib/agents/runtimeContractBundleClosureTypes";

export function buildRuntimeContractBundleItems(
  source: RuntimeApiContractDesignReport,
): readonly RuntimeContractBundleItem[] {
  if (!isSourceReadyForBundleItems(source)) {
    return [];
  }

  return STAGE7_C_REQUIRED_BUNDLE_ITEM_IDS.map((bundleItemId) => {
    const spec = STAGE7_C_BUNDLE_ITEM_SPECS[bundleItemId];
    return {
      bundleItemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      source: spec.source,
      designOnly: true as const,
      implementedInThisStep: false as const,
      stage8Candidate: spec.stage8Candidate,
      requiredBeforeStage8: spec.requiredBeforeStage8,
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      requiredApprovals: [...spec.requiredApprovals],
    };
  });
}
