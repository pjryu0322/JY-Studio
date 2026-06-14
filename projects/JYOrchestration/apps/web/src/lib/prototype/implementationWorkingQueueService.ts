import { buildDeveloperMemoryDraftFromQueue } from "@/lib/prototype/implementationDeveloperMemory";
import type {
  ImplementationDeveloperMemoryDraft,
  ImplementationWorkingQueueItem,
  ImplementationWorkingQueueV1,
} from "@/lib/prototype/implementationWorkingQueueTypes";
import { IMPLEMENTATION_PREVIEW_FEEDBACK_INTENT } from "@/lib/prototype/implementationWorkingQueuePreviewFeedback";
import type { WorkingQueueControlIntent } from "@/lib/prototype/implementationWorkingQueueControlIntent";

function nowIso(): string {
  return new Date().toISOString();
}

function newQueueItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `iwq-${crypto.randomUUID()}`;
  }
  return `iwq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @deprecated Legacy/test helper only — no keyword inference. Product path uses LLM drafts.
 */
export function enqueueWorkingQueueSupplement(input: {
  readonly queue: ImplementationWorkingQueueV1;
  readonly rawUserMessage: string;
  readonly sourceMessageId?: string;
}): Readonly<{ queue: ImplementationWorkingQueueV1; item: ImplementationWorkingQueueItem }> {
  const pid = input.queue.projectId.trim();
  const raw = input.rawUserMessage.trim();
  const now = nowIso();
  const compact = raw.replace(/\s+/g, " ");
  const title = compact.length <= 48 ? compact : `${compact.slice(0, 45)}…`;
  const item: ImplementationWorkingQueueItem = {
    id: newQueueItemId(),
    projectId: pid,
    sourceMessageId: input.sourceMessageId,
    rawUserMessage: raw,
    title,
    description: raw,
    affectedArea: "unknown",
    status: "pending",
    riskLevel: "medium",
    createdAt: now,
    updatedAt: now,
  };
  return {
    queue: {
      ...input.queue,
      items: [...input.queue.items, item],
      updatedAt: now,
    },
    item,
  };
}

export function enqueueWorkingQueueFromItem(input: {
  readonly queue: ImplementationWorkingQueueV1;
  readonly item: ImplementationWorkingQueueItem;
}): Readonly<{ queue: ImplementationWorkingQueueV1; item: ImplementationWorkingQueueItem }> {
  const now = nowIso();
  return {
    queue: {
      ...input.queue,
      items: [...input.queue.items, input.item],
      updatedAt: now,
    },
    item: input.item,
  };
}

function pendingItems(queue: ImplementationWorkingQueueV1): ImplementationWorkingQueueItem[] {
  return queue.items.filter((i) => i.status === "pending");
}

function patchItems(
  queue: ImplementationWorkingQueueV1,
  updater: (item: ImplementationWorkingQueueItem) => ImplementationWorkingQueueItem,
): ImplementationWorkingQueueV1 {
  const now = nowIso();
  return {
    ...queue,
    items: queue.items.map(updater),
    updatedAt: now,
  };
}

export function applyWorkingQueueControlIntent(input: {
  readonly queue: ImplementationWorkingQueueV1;
  readonly intent: WorkingQueueControlIntent;
}): Readonly<{
  queue: ImplementationWorkingQueueV1;
  approved: ImplementationWorkingQueueItem[];
  deferred: ImplementationWorkingQueueItem[];
  rejected: ImplementationWorkingQueueItem[];
}> {
  const pending = pendingItems(input.queue);
  const approved: ImplementationWorkingQueueItem[] = [];
  const deferred: ImplementationWorkingQueueItem[] = [];
  const rejected: ImplementationWorkingQueueItem[] = [];
  const now = nowIso();

  const approveIds = new Set<string>();
  const deferIds = new Set<string>();
  const rejectIds = new Set<string>();

  switch (input.intent.kind) {
    case "approve_all":
      for (const p of pending) approveIds.add(p.id);
      break;
    case "approve_one": {
      const target = pending[input.intent.index];
      if (target) approveIds.add(target.id);
      break;
    }
    case "approve_ids":
      for (const id of input.intent.ids) approveIds.add(id);
      break;
    case "defer_all":
      for (const p of pending) deferIds.add(p.id);
      break;
    case "reject_all":
      for (const p of pending) rejectIds.add(p.id);
      break;
    case "defer_one": {
      const target = pending[input.intent.index];
      if (target) deferIds.add(target.id);
      break;
    }
    case "reject_one": {
      const target = pending[input.intent.index];
      if (target) rejectIds.add(target.id);
      break;
    }
  }

  const next = patchItems(input.queue, (item) => {
    if (approveIds.has(item.id) && item.status === "pending") {
      const nextItem = { ...item, status: "approved" as const, updatedAt: now };
      approved.push(nextItem);
      return nextItem;
    }
    if (deferIds.has(item.id) && item.status === "pending") {
      const nextItem = { ...item, status: "deferred" as const, updatedAt: now };
      deferred.push(nextItem);
      return nextItem;
    }
    if (rejectIds.has(item.id) && item.status === "pending") {
      const nextItem = { ...item, status: "rejected" as const, updatedAt: now };
      rejected.push(nextItem);
      return nextItem;
    }
    return item;
  });

  return { queue: next, approved, deferred, rejected };
}

export function updateWorkingQueueItemStatus(input: {
  readonly queue: ImplementationWorkingQueueV1;
  readonly itemId: string;
  readonly status: ImplementationWorkingQueueItem["status"];
}): ImplementationWorkingQueueV1 {
  const now = nowIso();
  return {
    ...input.queue,
    updatedAt: now,
    items: input.queue.items.map((item) =>
      item.id === input.itemId ? { ...item, status: input.status, updatedAt: now } : item,
    ),
  };
}

export function buildMemoryAfterQueueChange(input: {
  readonly queue: ImplementationWorkingQueueV1;
  readonly latestPreviewUrl?: string | null;
  readonly prior?: ImplementationDeveloperMemoryDraft | null;
}): ImplementationDeveloperMemoryDraft {
  return buildDeveloperMemoryDraftFromQueue({
    projectId: input.queue.projectId,
    items: input.queue.items,
    latestPreviewUrl: input.latestPreviewUrl,
    prior: input.prior,
  });
}

