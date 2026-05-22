/**
 * Stage 13-A adapter candidate items (read-only).
 */

import {
  STAGE13_A_CANDIDATE_ITEM_SPECS,
  STAGE13_A_REQUIRED_ITEM_IDS,
} from "@/lib/agents/actualExternalExecutionAdapterCandidateConstants";
import { isSourceReadyForActualExternalExecutionAdapterCandidate } from "@/lib/agents/actualExternalExecutionAdapterCandidateSource";
import type { ActualExternalExecutionAdapterCandidateItem } from "@/lib/agents/actualExternalExecutionAdapterCandidateTypes";
import type { ExternalExecutionManualDryRunGateReport } from "@/lib/agents/externalExecutionManualDryRunGateTypes";

export function buildActualExternalExecutionAdapterCandidateItems(
  source: ExternalExecutionManualDryRunGateReport,
): readonly ActualExternalExecutionAdapterCandidateItem[] {
  if (!isSourceReadyForActualExternalExecutionAdapterCandidate(source)) {
    return [];
  }

  return STAGE13_A_REQUIRED_ITEM_IDS.map((itemId) => {
    const spec = STAGE13_A_CANDIDATE_ITEM_SPECS[itemId];
    return {
      itemId,
      area: spec.area,
      title: spec.title,
      purpose: spec.purpose,
      source: "stage12_a_external_execution_manual_dry_run_gate" as const,
      candidateOnly: true as const,
      implementedInThisStep: false as const,
      actualExternalExecutionAllowedInThisStep: false as const,
      actualCursorAdapterImplementedInThisStep: false as const,
      actualGithubAdapterImplementedInThisStep: false as const,
      actualConnectorAdapterImplementedInThisStep: false as const,
      actualRunnerAdapterImplementedInThisStep: false as const,
      actualAdapterCredentialUsageAllowedInThisStep: false as const,
      actualNetworkSideEffectAllowedInThisStep: false as const,
      actualDbPersistenceAllowedInThisStep: false as const,
      actualUiImplementationAllowedInThisStep: false as const,
      agentRegistryMutationAllowedInThisStep: false as const,
      stage14Candidate: spec.stage14Candidate,
      requiredBeforeStage14: spec.requiredBeforeStage14,
      forbiddenInThisStep: [...spec.forbiddenInThisStep],
      requiredApprovals: [...spec.requiredApprovals],
    };
  });
}
