import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CompletedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import {
  isLegacySampleDataSupplementalMergeEnabled,
  resolveVerifiedSampleDataSupplementalMergeTarget,
} from "@/lib/prototype/legacySampleDataSupplementalMerge";
import { SAMPLE_DATA_WORK_BRANCH } from "@/lib/prototype/sampleDataCodeTaskPlanner";

export type { LegacySampleDataFallbackMergeV1 } from "@/lib/prototype/legacySampleDataSupplementalMerge";

export { resolveVerifiedSampleDataSupplementalMergeTarget } from "@/lib/prototype/legacySampleDataSupplementalMerge";

export type IntegrationBranchMergeResolutionV1 = Readonly<{
  readonly mergeItems: readonly CompletedCodeTaskIntegrationTarget[];
  readonly legacySampleDataFallback: import("@/lib/prototype/legacySampleDataSupplementalMerge").LegacySampleDataFallbackMergeV1 | null;
}>;

function appendUniqueBranches(
  items: readonly CompletedCodeTaskIntegrationTarget[],
): CompletedCodeTaskIntegrationTarget[] {
  const out: CompletedCodeTaskIntegrationTarget[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const branch = item.workBranch?.trim();
    if (!branch || seen.has(branch)) continue;
    seen.add(branch);
    out.push(item);
  }
  return out;
}

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
    mergeItems: appendUniqueBranches([supplemental, ...headItems]),
    legacySampleDataFallback: {
      reason: "sample_data_missing_from_included_selector",
      branch: supplemental.workBranch ?? SAMPLE_DATA_WORK_BRANCH,
      codeTaskId: supplemental.codeTaskId,
    },
  };
}

/**
 * Linear-chain: merge sample-data (from included) then effective chain head.
 * Supplemental sample-data는 `JY_LEGACY_SAMPLE_SUPPLEMENTAL_MERGE=1`일 때만.
 */
export function resolveIntegrationBranchMergeItems(input: {
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly effectiveSourceBranch: string;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
}): IntegrationBranchMergeResolutionV1 {
  const legacy = maybeLegacySampleDataSupplement(input);
  if (legacy) return legacy;

  const included = input.included;
  if (included.length <= 1) {
    return { mergeItems: included, legacySampleDataFallback: null };
  }

  const effective = input.effectiveSourceBranch.trim();
  const headItems = included.filter((item) => item.workBranch?.trim() === effective).slice(-1);
  if (!headItems.length) {
    return { mergeItems: included, legacySampleDataFallback: null };
  }

  const dataItems = included
    .filter((item) => item.workBranch?.trim() === SAMPLE_DATA_WORK_BRANCH)
    .slice(-1);

  if (!dataItems.length || effective === SAMPLE_DATA_WORK_BRANCH) {
    return { mergeItems: headItems, legacySampleDataFallback: null };
  }

  return {
    mergeItems: appendUniqueBranches([...dataItems, ...headItems]),
    legacySampleDataFallback: null,
  };
}
