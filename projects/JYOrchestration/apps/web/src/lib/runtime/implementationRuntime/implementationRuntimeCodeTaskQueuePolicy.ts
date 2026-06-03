import type { TaskCursorGithubVerifyResult } from "@/lib/prototype/taskCursorGithubVerify";
import type { ImplementationRuntimeCodeTaskQueueItemStatus } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueTypes";

/** No structured no-code-change field on verify result — do not infer from reason strings. */
export function resolveNoCodeChangeEvidence(
  _verify: TaskCursorGithubVerifyResult,
): string | null {
  const evidence = (_verify as { noCodeChangeEvidence?: string }).noCodeChangeEvidence?.trim();
  return evidence || null;
}

export function canCompleteQueueItemFromGithubVerify(
  verify: TaskCursorGithubVerifyResult,
): boolean {
  return Boolean(verify.ok && String(verify.verifiedCommitSha ?? "").trim());
}

export function resolveQueueItemStatusAfterGithubVerify(input: {
  readonly verify: TaskCursorGithubVerifyResult;
}): ImplementationRuntimeCodeTaskQueueItemStatus {
  const verify = input.verify;
  if (verify.ok && verify.verifiedCommitSha?.trim()) {
    return "completed";
  }
  if (
    verify.detailReason === "path_guard_failed" ||
    verify.detailReason === "commit_message_missing_task_id" ||
    verify.detailReason === "changed_files_empty"
  ) {
    return "rework_required";
  }
  return "failed";
}
