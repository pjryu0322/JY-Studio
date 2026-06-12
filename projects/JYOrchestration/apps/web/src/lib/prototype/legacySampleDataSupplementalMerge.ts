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

/** Legacy opt-in — 기본 통합 경로에서는 사용하지 않는다. */
export function isLegacySampleDataSupplementalMergeEnabled(): boolean {
  return String(process.env.JY_LEGACY_SAMPLE_SUPPLEMENTAL_MERGE ?? "").trim() === "1";
}

/** @deprecated Included selector만 SoT. `JY_LEGACY_SAMPLE_SUPPLEMENTAL_MERGE=1`일 때만 merge 보조. */
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
