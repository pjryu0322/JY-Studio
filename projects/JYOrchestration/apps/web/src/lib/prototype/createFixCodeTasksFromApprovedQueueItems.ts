import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";
import {
  buildWorkingQueueApprovalOrchestrationPatch,
  type WorkingQueueApprovalPersistResult,
} from "@/lib/prototype/implementationWorkingQueueFixCodeTasks";

/**
 * Builds orchestration state for approved Working Queue items (Fix CodeTasks + execution runs).
 * Call from the Working Queue [승인] button path only — not from chat.
 */
export function createFixCodeTasksFromApprovedQueueItems(
  projectId: string,
  approvedItems: readonly ImplementationWorkingQueueItem[],
  input: {
    readonly requirementsStateJson: unknown;
    readonly queue: import("@/lib/prototype/implementationWorkingQueueTypes").ImplementationWorkingQueueV1;
    readonly nowIso?: string;
  },
): WorkingQueueApprovalPersistResult {
  const pid = projectId.trim();
  if (!pid || !approvedItems.length) {
    return { orchestrationPatch: {}, createdCodeTaskIds: [] };
  }
  return buildWorkingQueueApprovalOrchestrationPatch({
    projectId: pid,
    requirementsStateJson: input.requirementsStateJson,
    queue: input.queue,
    approvedItems,
    nowIso: input.nowIso,
  });
}
