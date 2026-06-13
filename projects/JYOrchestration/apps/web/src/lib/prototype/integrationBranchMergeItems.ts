import type { CompletedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationBranchTopologyV1 } from "@/lib/prototype/implementationBranchTopology";
import {
  isLegacySampleDataSupplementalMergeEnabled,
  resolveVerifiedSampleDataSupplementalMergeTarget,
} from "@/lib/prototype/legacySampleDataSupplementalMerge";
import {
  mapImplementationBranchTopologyKind,
  resolveIntegrationMergeTargets,
  type IntegrationMergeTargetsResultV1,
} from "@/lib/prototype/integrationMergeTargetsResolver";
import { SAMPLE_DATA_WORK_BRANCH } from "@/lib/prototype/sampleDataCodeTaskPlanner";

export type { LegacySampleDataFallbackMergeV1 } from "@/lib/prototype/legacySampleDataSupplementalMerge";

export { resolveVerifiedSampleDataSupplementalMergeTarget } from "@/lib/prototype/legacySampleDataSupplementalMerge";

export type IntegrationBranchMergeResolutionV1 = Readonly<{
  readonly mergeItems: readonly CompletedCodeTaskIntegrationTarget[];
  readonly legacySampleDataFallback: import("@/lib/prototype/legacySampleDataSupplementalMerge").LegacySampleDataFallbackMergeV1 | null;
  readonly mergePlan: IntegrationMergeTargetsResultV1;
}>;

function maybeLegacySampleDataSupplement(input: {
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly effectiveSourceBranch: string;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
}): IntegrationBranchMergeResolutionV1 | null {
  if (!isLegacySampleDataSupplementalMergeEnabled()) return null;

  const effective = input.effectiveSourceBranch.trim();
  const supplemental = resolveVerifiedSampleDataSupplementalMergeTarget({
    codeTaskRuns: input.codeTaskRuns,
  });
  if (!supplemental) return null;

  const hasSampleInIncluded = input.included.some(
    (item) => item.workBranch?.trim() === SAMPLE_DATA_WORK_BRANCH,
  );
  if (hasSampleInIncluded) return null;

  const headItems = input.included.filter((item) => item.workBranch?.trim() === effective).slice(-1);
  if (!headItems.length) return null;

  return {
    mergeItems: [supplemental, ...headItems],
    legacySampleDataFallback: {
      reason: "sample_data_missing_from_included_selector",
      branch: supplemental.workBranch ?? SAMPLE_DATA_WORK_BRANCH,
      codeTaskId: supplemental.codeTaskId,
    },
    mergePlan: resolveIntegrationMergeTargets({
      topology: "unknown",
      effectiveSourceBranch: effective,
      sourceBranches: [supplemental.workBranch ?? SAMPLE_DATA_WORK_BRANCH, effective],
    }),
  };
}

function pickMergeItemsForTargets(
  included: readonly CompletedCodeTaskIntegrationTarget[],
  mergeTargets: readonly string[],
): readonly CompletedCodeTaskIntegrationTarget[] {
  const items: CompletedCodeTaskIntegrationTarget[] = [];
  for (const branch of mergeTargets) {
    const targetBranch = branch.trim();
    if (!targetBranch) continue;
    const matches = included.filter((item) => String(item.workBranch ?? "").trim() === targetBranch);
    const picked = matches[matches.length - 1];
    if (picked) items.push(picked);
  }
  return items;
}

/**
 * Resolves CodeTask merge rows from topology-aware branch merge targets.
 * Linear chain: effective source head only (no intermediate branch merges).
 */
export function resolveIntegrationBranchMergeItems(input: {
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly effectiveSourceBranch: string;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
  readonly topology?: ImplementationBranchTopologyV1 | null;
  readonly topologyChainHead?: string | null;
  readonly integrationBranch?: string | null;
  readonly baseBranch?: string | null;
}): IntegrationBranchMergeResolutionV1 {
  const topologyKind = mapImplementationBranchTopologyKind(input.topology);
  if (topologyKind !== "linear_chain") {
    const legacy = maybeLegacySampleDataSupplement(input);
    if (legacy) return legacy;
  }

  const sourceBranches = input.included
    .map((row) => String(row.workBranch ?? "").trim())
    .filter(Boolean);
  const orderedBranches =
    input.topology?.kind === "linear_chain" ? input.topology.orderedBranches : undefined;

  const mergePlan = resolveIntegrationMergeTargets({
    topology: topologyKind,
    effectiveSourceBranch: input.effectiveSourceBranch,
    topologyChainHead:
      input.topologyChainHead ??
      (input.topology?.kind === "linear_chain" ? input.topology.chainHead : null),
    sourceBranches,
    integrationBranch: input.integrationBranch,
    baseBranch: input.baseBranch,
    orderedBranches,
  });

  const mergeItems = pickMergeItemsForTargets(input.included, mergePlan.mergeTargets);

  return {
    mergeItems,
    legacySampleDataFallback: null,
    mergePlan,
  };
}
