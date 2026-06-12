import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { CompletedCodeTaskIntegrationTarget } from "@/lib/prototype/completedCodeTaskIntegrationSelector";
import { normalizeCodeTaskGithubOutcomeFromRun } from "@/lib/prototype/codeTaskGithubOutcome";
import { readCodeTaskRunCommitSha } from "@/lib/prototype/codeTaskRunPreviewPolicy";
import { findLatestSampleDataExecutionRun } from "@/lib/prototype/sampleDataArtifactsFetchService";
import { SAMPLE_DATA_WORK_BRANCH } from "@/lib/prototype/sampleDataCodeTaskPlanner";

/**
 * Linear-chain integration usually merges only the effective source (chain head).
 * Sample data often lives on {@link SAMPLE_DATA_WORK_BRANCH} without being in that branch's tip;
 * merge sample-data first, then the chain head, so Preview quality checks see both.
 */
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

export function resolveIntegrationBranchMergeItems(input: {
  readonly included: readonly CompletedCodeTaskIntegrationTarget[];
  readonly effectiveSourceBranch: string;
  readonly codeTaskRuns?: readonly CodeTaskExecutionRunV1[] | null;
}): readonly CompletedCodeTaskIntegrationTarget[] {
  const included = input.included;
  if (included.length <= 1) {
    const supplemental = resolveVerifiedSampleDataSupplementalMergeTarget({
      codeTaskRuns: input.codeTaskRuns,
    });
    if (supplemental && included.length === 1) {
      const only = included[0];
      const onlyBranch = only?.workBranch?.trim();
      if (onlyBranch && onlyBranch !== SAMPLE_DATA_WORK_BRANCH) {
        return [supplemental, only];
      }
    }
    return included;
  }

  const effective = input.effectiveSourceBranch.trim();
  const headItems = included.filter((item) => item.workBranch?.trim() === effective).slice(-1);
  if (!headItems.length) return included;

  let dataItems = included
    .filter((item) => item.workBranch?.trim() === SAMPLE_DATA_WORK_BRANCH)
    .slice(-1);

  if (!dataItems.length) {
    const supplemental = resolveVerifiedSampleDataSupplementalMergeTarget({
      codeTaskRuns: input.codeTaskRuns,
    });
    if (supplemental) {
      dataItems = [supplemental];
    }
  }

  if (!dataItems.length || effective === SAMPLE_DATA_WORK_BRANCH) {
    return headItems;
  }

  const out: CompletedCodeTaskIntegrationTarget[] = [];
  const seen = new Set<string>();
  for (const item of [...dataItems, ...headItems]) {
    const branch = item.workBranch?.trim();
    if (!branch || seen.has(branch)) continue;
    seen.add(branch);
    out.push(item);
  }
  return out;
}
