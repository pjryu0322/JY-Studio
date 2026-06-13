import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  findCodeTaskGithubPollingEntry,
  isCodeTaskGithubPollingBlockingIntegration,
} from "@/lib/prototype/implementationCodeTaskGithubPollingState";
import {
  normalizeCodeTaskGithubOutcomeFromRun,
} from "@/lib/prototype/codeTaskGithubOutcome";
import { readCodeTaskRunCommitSha } from "@/lib/prototype/codeTaskRunPreviewPolicy";
import { hasVerifiedCodeTaskCompletionEvidence } from "@/lib/prototype/implementationCodeTaskCompletionEvidence";

/**
 * 통합·Board 공통 SoT — 완료 outcome + GitHub 증거.
 * Board {@link resolveCodeTaskBoardState}의 isIntegrationReady와 동일 의미.
 */
export function isCodeTaskRunIntegrationReady(
  run: CodeTaskExecutionRunV1 | null | undefined,
  requirementsState?: RequirementsStateJson | null,
): boolean {
  const codeTaskId = String(run?.codeTaskId ?? "").trim();
  if (codeTaskId && requirementsState) {
    const pollingEntry = findCodeTaskGithubPollingEntry(requirementsState, codeTaskId);
    if (isCodeTaskGithubPollingBlockingIntegration(pollingEntry)) return false;
  }
  if (!run) return false;

  const github = normalizeCodeTaskGithubOutcomeFromRun(run);
  if (github?.status === "failed" || github?.status === "pending") return false;

  const commitSha = readCodeTaskRunCommitSha(run);
  const branchHeadCommit = String(run.branchHeadCommitSha ?? "").trim();
  const noCodeChange = run.status === "no_code_change_completed";

  const hasEvidence = hasVerifiedCodeTaskCompletionEvidence({
    commitSha,
    githubBranchHeadCommit: branchHeadCommit,
    branchHeadCommit,
    noCodeChangeEvidence: noCodeChange,
  });

  if (!hasEvidence) return false;
  if (noCodeChange) return true;

  if (
    run.status === "completed" ||
    run.status === "quality_gate_passed" ||
    run.status === "github_verified"
  ) {
    return github?.status === "verified" || Boolean(commitSha) || Boolean(branchHeadCommit);
  }

  return false;
}
