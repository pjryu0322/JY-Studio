import { workingQueueStatusLabelKo } from "@/lib/prototype/implementationWorkingQueueClassifier";
import type {
  ImplementationWorkingQueueItem,
  ImplementationWorkingQueueStatus,
} from "@/lib/prototype/implementationWorkingQueueTypes";

export const PREVIEW_CAPTURE_GENERIC_QUEUE_TITLE = "Preview 캡처 기반 보완요청" as const;

export type WorkingQueueListFilter = Readonly<{
  readonly status: "all" | ImplementationWorkingQueueStatus;
  readonly contentQuery: string;
}>;

export function workingQueueItemRequestText(item: ImplementationWorkingQueueItem): string {
  const description = item.description.trim();
  if (description) return description;
  const raw = item.rawUserMessage.trim();
  if (raw) return raw;
  return item.title.trim();
}

export function shouldShowWorkingQueueCardTitle(item: ImplementationWorkingQueueItem): boolean {
  const title = item.title.trim();
  if (!title) return false;
  if (title === PREVIEW_CAPTURE_GENERIC_QUEUE_TITLE) return false;
  const body = workingQueueItemRequestText(item);
  if (title === body) return false;
  return true;
}

export function filterWorkingQueueItems(
  items: readonly ImplementationWorkingQueueItem[],
  filter: WorkingQueueListFilter,
): ImplementationWorkingQueueItem[] {
  const q = filter.contentQuery.trim().toLowerCase();
  return items.filter((item) => {
    if (filter.status !== "all" && item.status !== filter.status) return false;
    if (!q) return true;
    const haystack = [
      item.title,
      item.description,
      item.rawUserMessage,
      item.desiredBehavior ?? "",
      item.targetUi ?? "",
      workingQueueStatusLabelKo(item.status),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function sortWorkingQueueItemsForDisplay(
  items: readonly ImplementationWorkingQueueItem[],
): ImplementationWorkingQueueItem[] {
  return [...items].sort((a, b) => {
    const order = (s: ImplementationWorkingQueueItem["status"]) => {
      if (s === "pending") return 0;
      if (s === "approved" || s === "running") return 1;
      if (s === "completed") return 2;
      return 3;
    };
    return order(a.status) - order(b.status) || b.updatedAt.localeCompare(a.updatedAt);
  });
}
