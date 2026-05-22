/**
 * Cursor execution job — ExecutionRun persistence (read-only writes to run row).
 */

import type { Prisma } from "@prisma/client";
import type { CursorRunResult, ExecuteCursorRunOutcome } from "@/lib/execution/cursorExecutionAdapter";
import { prisma } from "@/lib/prisma";

export function isCursorRunSuccessWithResult(
  outcome: ExecuteCursorRunOutcome
): outcome is { ok: true; result: CursorRunResult; logs: string[] } {
  return Boolean(outcome.ok && "result" in outcome);
}

export async function persistCursorExecutionSuccess(
  execRunId: string,
  outcome: ExecuteCursorRunOutcome
): Promise<void> {
  if (!isCursorRunSuccessWithResult(outcome)) return;
  const cr = outcome.result;
  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: {
      status: "awaiting_git_reflection",
      runError: null,
      changedFiles: cr.changedFiles?.length ? (cr.changedFiles as Prisma.InputJsonValue) : undefined,
      commitSha: cr.commitHash ?? null,
      pushStatus: cr.prUrl ? "pr_reported_by_cursor" : "delegated_to_cursor",
      prStatus: cr.prUrl ? `pr:${cr.prUrl}`.slice(0, 500) : undefined,
    },
  });
}

export async function persistCursorExecutionFailure(execRunId: string, message: string): Promise<void> {
  await prisma.taskExecutionRun.update({
    where: { id: execRunId },
    data: {
      status: "failed",
      runError: message.slice(0, 8000),
      evaluationDecision: "failed",
      evaluationReason: `cursor_worker:${message}`.slice(0, 2000),
    },
  });
}
