import type { TaskCursorGithubVerifyInput } from "@/lib/prototype/taskCursorGithubVerify";
import { verifyTaskCursorGithubResult } from "@/lib/prototype/taskCursorGithubVerify";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";
import {
  completeImplementationRuntimeGithubVerifyAndAdvance,
  failImplementationRuntimeGithubVerify,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeExecutionService";

export type ImplementationGithubVerificationOutcome = Readonly<{
  readonly ok: boolean;
  readonly bundle: ImplementationRuntimeBundleView;
  readonly message?: string;
  readonly verifiedCommitSha?: string;
}>;

/**
 * GitHub REST를 Runtime 완료의 Source of Truth로 사용한다.
 * Cursor agent terminal 상태와 무관하게 verify 결과만 DB runtime을 전진/실패시킨다.
 */
export async function verifyImplementationRuntimeRunOnGithub(input: {
  readonly projectId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly verify: TaskCursorGithubVerifyInput;
}): Promise<ImplementationGithubVerificationOutcome> {
  const verify = await verifyTaskCursorGithubResult(input.verify);
  if (!verify.ok) {
    const bundle = await failImplementationRuntimeGithubVerify({
      projectId: input.projectId,
      jobId: input.jobId,
      runId: input.runId,
      failureReason: verify.message ?? verify.reason ?? "github_verify_failed",
    });
    return { ok: false, bundle, message: verify.message };
  }

  const bundle = await completeImplementationRuntimeGithubVerifyAndAdvance({
    projectId: input.projectId,
    jobId: input.jobId,
    runId: input.runId,
    commitSha: verify.verifiedCommitSha ?? null,
    pullRequestUrl: null,
  });
  return {
    ok: true,
    bundle,
    verifiedCommitSha: verify.verifiedCommitSha,
  };
}
