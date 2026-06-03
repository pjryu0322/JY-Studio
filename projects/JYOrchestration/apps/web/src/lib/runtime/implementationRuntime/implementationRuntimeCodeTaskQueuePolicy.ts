import type { TaskCursorGithubVerifyResult } from "@/lib/prototype/taskCursorGithubVerify";
import type { ImplementationRuntimeCodeTaskQueueItemStatus } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueTypes";

export function resolveNoCodeChangeEvidence(
  verify: TaskCursorGithubVerifyResult,
): string | null {
  const evidence = verify.noCodeChangeEvidence?.trim();
  return evidence || null;
}

export function canCompleteQueueItemFromGithubVerify(
  verify: TaskCursorGithubVerifyResult,
): boolean {
  if (verify.ok && String(verify.verifiedCommitSha ?? "").trim()) {
    return true;
  }
  return resolveNoCodeChangeEvidence(verify) !== null;
}

export function resolveQueueItemStatusAfterGithubVerify(input: {
  readonly verify: TaskCursorGithubVerifyResult;
}): ImplementationRuntimeCodeTaskQueueItemStatus {
  const verify = input.verify;
  if (verify.ok && verify.verifiedCommitSha?.trim()) {
    return "completed";
  }
  const noCodeEvidence = resolveNoCodeChangeEvidence(verify);
  if (noCodeEvidence) {
    return "no_code_change_completed";
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
