import type { TaskCursorGithubVerifyResult } from "@/lib/prototype/taskCursorGithubVerify";
import type { ImplementationRuntimeCodeTaskQueueItemStatus } from "@/lib/runtime/implementationRuntime/implementationRuntimeCodeTaskQueueTypes";

/** Structured no-code-change evidence only — reason substring alone is not enough. */
export function resolveNoCodeChangeEvidence(
  verify: TaskCursorGithubVerifyResult,
): string | null {
  if (verify.ok) return null;
  if (verify.detailReason === "changed_files_empty") {
    const message = verify.message?.trim();
    return message || "changed_files_empty";
  }
  return null;
}

export function canCompleteQueueItemFromGithubVerify(
  verify: TaskCursorGithubVerifyResult,
): boolean {
  if (verify.ok) {
    return Boolean(String(verify.verifiedCommitSha ?? "").trim());
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
