import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { isCodeTaskRunIntegrationReady } from "@/lib/prototype/codeTaskIntegrationReadiness";
import { normalizeCodeTaskGithubOutcomeFromRun } from "@/lib/prototype/codeTaskGithubOutcome";
import { normalizeCodeTaskQualityOutcomeFromRun } from "@/lib/prototype/codeTaskQualityOutcome";
import type { CodeTaskRun } from "@/lib/prototype/implementationRuntimeStateModel";

export function isCodeTaskRunPreviewIncluded(run: CodeTaskRun | null | undefined): boolean {
  return isCodeTaskRunMergeIncluded(run);
}

/** P3-M44: 통합 branch merge 대상 — {@link isCodeTaskRunIntegrationReady}와 동일. */
export function isCodeTaskRunMergeIncluded(run: CodeTaskRun | null | undefined): boolean {
  if (!run) return false;
  if (isCodeTaskRunIntegrationReady(run)) return true;

  const quality = normalizeCodeTaskQualityOutcomeFromRun(run);
  if (quality?.status === "passed") {
    const github = normalizeCodeTaskGithubOutcomeFromRun(run);
    if (github?.status === "failed" || github?.status === "pending") return false;
    const commitSha = readCodeTaskRunCommitSha(run);
    return Boolean(commitSha) || run.status === "no_code_change_completed";
  }

  return false;
}

export function readCodeTaskRunCommitSha(run: CodeTaskExecutionRunV1 | null | undefined): string | null {
  const outcome = run ? normalizeCodeTaskGithubOutcomeFromRun(run) : null;
  if (outcome?.status === "verified") {
    return outcome.commitSha.trim() || null;
  }
  const sha = String(run?.commitSha ?? run?.branchHeadCommitSha ?? "").trim();
  return sha || null;
}
