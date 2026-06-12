import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CompletedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import { normalizeCodeTaskGithubOutcomeFromRun } from "@/lib/prototype/codeTaskGithubOutcome";
import { readCodeTaskRunCommitSha } from "@/lib/prototype/codeTaskRunPreviewPolicy";
import { findLatestSampleDataExecutionRun } from "@/lib/prototype/sampleDataArtifactsFetchService";
import { SAMPLE_DATA_WORK_BRANCH } from "@/lib/prototype/sampleDataCodeTaskPlanner";

export type LegacySampleDataFallbackMergeV1 = Readonly<{
  readonly reason: string;
  readonly branch: string;
  readonly codeTaskId: string;
}>;

export type IntegrationBranchMergeResolutionV1 = Readonly<{
  readonly mergeItems: readonly CompletedCodeTaskIntegrationTarget[];
  readonly legacySampleDataFallback: LegacySampleDataFallbackMergeV1 | null;
}>;

/** @deprecated Legacy bridge — 기본 통합 경로는 selector `included`만 사용. */
export function resolveVerifiedSampleDataSupplementalMergeTarget(input: {
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
}): CompletedCodeTaskIntegrationTarget | null {
  const run = findLatestSampleDataExecutionRun({ runs: input.codeTaskRuns ?? [] });
  if (!run) return null;
  const github = normalizeCodeTaskGithubOutcomeFromRun(run);
  if (github?.status !== "verified") return null;
  const workBranch = String(run.workBranch ?? "").trim();
  if (workBranch !== SAMPLE_DATA_WORK_BRANCH) return null;
  const commitSha = readCodeTaskRunCommitSha(run);
  if (!commitSha) return null;
  return {
    codeTaskId: run.codeTaskId,
    taskId: run.processTaskId,
    title: "",
    status: run.status,
    commitSha,
    workBranch,
    source: "runtime_run",
  };
}

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

/**
 * Linear-chain: merge sample-data (from included) then effective chain head.
 * Supplemental sample-data merge는 included에 없을 때만 fallback.
 */
export function resolveIntegrationBranchMergeItems(input: {
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly effectiveSourceBranch: string;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
}): IntegrationBranchMergeResolutionV1 {
  const included = input.included;
  if (included.length <= 1) {
    const only = included[0];
    const supplemental = resolveVerifiedSampleDataSupplementalMergeTarget({
      codeTaskRuns: input.codeTaskRuns,
    });
    if (
      supplemental &&
      only &&
      only.workBranch?.trim() !== SAMPLE_DATA_WORK_BRANCH &&
      only.workBranch?.trim() !== supplemental.workBranch?.trim()
    ) {
      return {
        mergeItems: appendUniqueBranches([supplemental, only]),
        legacySampleDataFallback: {
          reason: "sample_data_missing_from_included_selector",
          branch: supplemental.workBranch ?? SAMPLE_DATA_WORK_BRANCH,
          codeTaskId: supplemental.codeTaskId,
        },
      };
    }
    return { mergeItems: included, legacySampleDataFallback: null };
  }

  const effective = input.effectiveSourceBranch.trim();
  const headItems = included.filter((item) => item.workBranch?.trim() === effective).slice(-1);
  if (!headItems.length) {
    return { mergeItems: included, legacySampleDataFallback: null };
  }

  let dataItems = included
    .filter((item) => item.workBranch?.trim() === SAMPLE_DATA_WORK_BRANCH)
    .slice(-1);

  let legacySampleDataFallback: LegacySampleDataFallbackMergeV1 | null = null;

  if (!dataItems.length) {
    const supplemental = resolveVerifiedSampleDataSupplementalMergeTarget({
      codeTaskRuns: input.codeTaskRuns,
    });
    if (supplemental) {
      dataItems = [supplemental];
      legacySampleDataFallback = {
        reason: "sample_data_missing_from_included_selector",
        branch: supplemental.workBranch ?? SAMPLE_DATA_WORK_BRANCH,
        codeTaskId: supplemental.codeTaskId,
      };
    }
  }

  if (!dataItems.length || effective === SAMPLE_DATA_WORK_BRANCH) {
    return { mergeItems: headItems, legacySampleDataFallback: null };
  }

  return {
    mergeItems: appendUniqueBranches([...dataItems, ...headItems]),
    legacySampleDataFallback,
  };
}
