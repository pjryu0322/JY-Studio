/**
 * Stage 10-A external execution adapter boundary items (read-only).
 */

import {
  STAGE10_A_BOUNDARY_ITEM_SPECS,
  STAGE10_A_REQUIRED_ITEM_IDS,
} from "@/lib/agents/externalExecutionAdapterBoundaryConstants";
import { isSourceReadyForAdapterBoundaryItems } from "@/lib/agents/externalExecutionAdapterBoundaryItemSource";
import type { RuntimeExecutionMvpClosureReport } from "@/lib/agents/runtimeExecutionMvpClosureTypes";
import type { ExternalExecutionAdapterBoundaryItem } from "@/lib/agents/externalExecutionAdapterBoundaryTypes";

export function buildExternalExecutionAdapterBoundaryItems(
  source: RuntimeExecutionMvpClosureReport,
): readonly ExternalExecutionAdapterBoundaryItem[] {
  if (!isSourceReadyForAdapterBoundaryItems(source)) {
    return [];
  }

  return STAGE10_A_REQUIRED_ITEM_IDS.map((itemId) => {
    const spec = STAGE10_A_BOUNDARY_ITEM_SPECS[itemId];
    return {
      itemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      source: "stage9_b_runtime_mvp_closure" as const,
      designOnly: true as const,
      implementedInThisStep: false as const,
      externalExecutionAllowedInThisStep: false as const,
      cursorExecutionAllowedInThisStep: false as const,
      githubWriteAllowedInThisStep: false as const,
      connectorGatewayCallAllowedInThisStep: false as const,
      dbPersistenceAllowedInThisStep: false as const,
      productionRunnerAllowedInThisStep: false as const,
      stage11Candidate: spec.stage11Candidate,
      requiredBeforeStage11: spec.requiredBeforeStage11,
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      requiredApprovals: [...spec.requiredApprovals],
    };
  });
}
