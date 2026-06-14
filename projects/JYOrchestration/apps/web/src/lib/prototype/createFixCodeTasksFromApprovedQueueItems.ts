import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";

/**
 * Approved queue items → fix CodeTask creation (Epic1-2 boundary).
 * Pipeline execution is intentionally not wired in this epic.
 */
export async function createFixCodeTasksFromApprovedQueueItems(
  projectId: string,
  approvedItems: readonly ImplementationWorkingQueueItem[],
): Promise<void> {
  const pid = projectId.trim();
  if (!pid || !approvedItems.length) return;
  console.info("[implementation-working-queue] createFixCodeTasksFromApprovedQueueItems (stub)", {
    projectId: pid,
    count: approvedItems.length,
    itemIds: approvedItems.map((i) => i.id),
    titles: approvedItems.map((i) => i.title),
  });
}
