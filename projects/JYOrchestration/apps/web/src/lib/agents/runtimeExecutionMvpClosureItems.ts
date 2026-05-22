/**
 * Stage 9-B runtime MVP closure bundle items (read-only).
 */

import {
  STAGE9_B_CLOSURE_ITEM_SPECS,
  STAGE9_B_REQUIRED_ITEM_IDS,
} from "@/lib/agents/runtimeExecutionMvpClosureConstants";
import { isSourceReadyForMvpClosureItems } from "@/lib/agents/runtimeExecutionMvpClosureItemSource";
import type { RuntimeExecutionApiMvpReport } from "@/lib/agents/runtimeExecutionApiMvpTypes";
import type { RuntimeExecutionMvpClosureItem } from "@/lib/agents/runtimeExecutionMvpClosureTypes";

export function buildRuntimeExecutionMvpClosureItems(
  source: RuntimeExecutionApiMvpReport,
): readonly RuntimeExecutionMvpClosureItem[] {
  if (!isSourceReadyForMvpClosureItems(source)) {
    return [];
  }

  return STAGE9_B_REQUIRED_ITEM_IDS.map((itemId) => {
    const spec = STAGE9_B_CLOSURE_ITEM_SPECS[itemId];
    return {
      itemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      source: "stage9_a_runtime_execution_api_mvp" as const,
      mvpImplemented: spec.mvpImplemented,
      actualExternalExecution: false as const,
      dbPersistence: false as const,
      productionRunner: false as const,
      stage10Candidate: spec.stage10Candidate,
      requiredBeforeStage10: spec.requiredBeforeStage10,
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      requiredApprovals: [...spec.requiredApprovals],
    };
  });
}
