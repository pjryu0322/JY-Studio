import type {
  TaskCursorGithubVerifyInput,
  TaskCursorGithubVerifyResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import {
  isTransientTaskCursorGithubVerifyMiss,
  verifyTaskCursorGithubResult,
} from "@/lib/prototype/taskCursorGithubVerify";
import { getImplementationRuntimeBundle } from "@/lib/runtime/implementationRuntime/implementationRuntimeRepository";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import { dispatchDbQueuedAutoAdvanceOnServer } from "@/lib/prototype/implementationDbQueuedExecutionUnitDispatch";
import { persistTaskCursorOrchestrationToProject } from "@/lib/prototype/taskCursorJobStateSync";
import {
  completeImplementationRuntimeGithubVerifyAndAdvance,
  failImplementationRuntimeGithubVerify,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";

export type ImplementationGithubVerificationOutcomeType =
  | "github_verified"
  | "github_missing"
  | "github_failed";

export type ImplementationGithubVerificationOutcome = Readonly<{
  readonly ok: boolean;
  readonly outcomeType: ImplementationGithubVerificationOutcomeType;
  readonly bundle: ImplementationRuntimeBundleView;
  readonly message?: string;
  readonly verifiedCommitSha?: string;
}>;

function resolveOutcomeType(
  verify: TaskCursorGithubVerifyResult,
): ImplementationGithubVerificationOutcomeType {
  if (verify.ok) return "github_verified";
  const missing =
    verify.detailReason === "branch_not_found" || verify.detailReason === "commit_not_found";
  return missing ? "github_missing" : "github_failed";
}

/** Precomputed GitHub verify 결과만으로 Runtime completed/failed를 결정한다 (REST 재호출 없음). */
export async function applyImplementationRuntimeGithubVerifyResult(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly verifyResult: TaskCursorGithubVerifyResult;
  readonly pullRequestUrl?: string | null;
}): Promise<ImplementationGithubVerificationOutcome> {
  const verify = input.verifyResult;
  if (!verify.ok) {
    const outcomeType = resolveOutcomeType(verify);
    if (isTransientTaskCursorGithubVerifyMiss(verify)) {
      const bundle = await getImplementationRuntimeBundle(input.projectId);
      return {
        ok: false,
        outcomeType: "github_missing",
        bundle,
        message: verify.message,
      };
    }
    const bundle = await failImplementationRuntimeGithubVerify({
      projectId: input.projectId,
      jobId: input.jobId,
      runId: input.runId,
      failureReason: verify.message ?? verify.reason ?? "github_verify_failed",
    });
    return { ok: false, outcomeType, bundle, message: verify.message };
  }

  const bundle = await completeImplementationRuntimeGithubVerifyAndAdvance({
    projectId: input.projectId,
    jobId: input.jobId,
    runId: input.runId,
    commitSha: verify.verifiedCommitSha ?? null,
    pullRequestUrl: input.pullRequestUrl ?? null,
  });
  const continuation = await dispatchDbQueuedAutoAdvanceOnServer({
    projectId: input.projectId.trim(),
  }).catch(() => null);
  if (continuation?.orchestrationPatch) {
    await persistTaskCursorOrchestrationToProject({
      projectId: input.projectId.trim(),
      orchestrationPatch: continuation.orchestrationPatch,
    }).catch(() => undefined);
  }
  return {
    ok: true,
    outcomeType: "github_verified",
    bundle,
    verifiedCommitSha: verify.verifiedCommitSha,
  };
}

/**
 * GitHub REST를 Runtime 완료의 Source of Truth로 사용한다.
 * Cursor terminal 상태를 참조하지 않으며 verify 결과만으로 completed/failed를 결정한다.
 */
export async function verifyImplementationRuntimeRunOnGithub(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly verify: TaskCursorGithubVerifyInput;
}): Promise<ImplementationGithubVerificationOutcome> {
  const verifyResult = await verifyTaskCursorGithubResult(input.verify);
  return applyImplementationRuntimeGithubVerifyResult({
    projectId: input.projectId,
    jobId: input.jobId,
    runId: input.runId,
    verifyResult,
    pullRequestUrl: null,
  });
}

/** Task Cursor poll에서 이미 검증된 GitHub outcome(commit)만으로 Runtime을 완료한다. */
export async function completeImplementationRuntimeFromRecordedGithubOutcome(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly commitSha: string;
  readonly pullRequestUrl?: string | null;
}): Promise<ImplementationGithubVerificationOutcome> {
  const commitSha = input.commitSha.trim();
  if (!commitSha) {
    throw new Error("commitSha required for recorded github outcome");
  }
  const bundle = await completeImplementationRuntimeGithubVerifyAndAdvance({
    projectId: input.projectId,
    jobId: input.jobId,
    runId: input.runId,
    commitSha,
    pullRequestUrl: input.pullRequestUrl ?? null,
  });
  const continuation = await dispatchDbQueuedAutoAdvanceOnServer({
    projectId: input.projectId.trim(),
  }).catch(() => null);
  if (continuation?.orchestrationPatch) {
    await persistTaskCursorOrchestrationToProject({
      projectId: input.projectId.trim(),
      orchestrationPatch: continuation.orchestrationPatch,
    }).catch(() => undefined);
  }
  return {
    ok: true,
    outcomeType: "github_verified",
    bundle,
    verifiedCommitSha: commitSha,
  };
}
