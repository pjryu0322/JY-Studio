import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { normalizeCodeTaskGithubOutcomeFromRun } from "@/lib/prototype/codeTaskGithubOutcome";
import { normalizeCodeTaskQualityOutcomeFromRun } from "@/lib/prototype/codeTaskQualityOutcome";
import type { CodeTaskRun } from "@/lib/prototype/implementationRuntimeStateModel";

export function isCodeTaskRunPreviewIncluded(run: CodeTaskRun | null | undefined): boolean {
  return isCodeTaskRunMergeIncluded(run);
}

/** P3-M44: 통합 branch merge 대상 — Run SoT (Preview와 동일 기준). */
export function isCodeTaskRunMergeIncluded(run: CodeTaskRun | null | undefined): boolean {
  if (!run) return false;

  const workBranch = String(run.workBranch ?? "").trim();
  if (!workBranch) return false;

  const github = normalizeCodeTaskGithubOutcomeFromRun(run);
  if (github?.status === "failed" || github?.status === "pending") return false;
  if (github?.status !== "verified" && run.status !== "no_code_change_completed") {
    return false;
  }

  if (run.status === "no_code_change_completed") {
    return true;
  }

  const commitSha = String(run.commitSha ?? run.branchHeadCommitSha ?? "").trim();
  if (!commitSha) return false;

  if (
    run.status === "completed" ||
    run.status === "quality_gate_passed" ||
    run.status === "no_code_change_completed"
  ) {
    return true;
  }

  const quality = normalizeCodeTaskQualityOutcomeFromRun(run);
  if (quality?.status === "passed") {
    return true;
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
