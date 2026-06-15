import { describe, expect, it } from "vitest";
import {
  filterWorkingQueueItems,
  PREVIEW_CAPTURE_GENERIC_QUEUE_TITLE,
  shouldShowWorkingQueueCardTitle,
  workingQueueItemRequestText,
} from "@/lib/prototype/implementationWorkingQueuePanelDisplay";
import type { ImplementationWorkingQueueItem } from "@/lib/prototype/implementationWorkingQueueTypes";

function item(overrides: Partial<ImplementationWorkingQueueItem> = {}): ImplementationWorkingQueueItem {
  return {
    id: "iwq-1",
    projectId: "p1",
    title: PREVIEW_CAPTURE_GENERIC_QUEUE_TITLE,
    description: "창 높이 조정",
    rawUserMessage: "창 높이 조정해줘",
    affectedArea: "ui",
    status: "pending",
    riskLevel: "medium",
    createdAt: "2026-06-14T00:00:00.000Z",
    updatedAt: "2026-06-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("implementationWorkingQueuePanelDisplay", () => {
  it("hides generic preview capture card title", () => {
    expect(shouldShowWorkingQueueCardTitle(item())).toBe(false);
    expect(workingQueueItemRequestText(item())).toBe("창 높이 조정");
  });

  it("filters by status and content query", () => {
    const items = [
      item({ id: "a", status: "pending", description: "스크롤 제거" }),
      item({ id: "b", status: "deferred", description: "타이틀 굵게" }),
    ];
    expect(filterWorkingQueueItems(items, { status: "pending", contentQuery: "" })).toHaveLength(1);
    expect(filterWorkingQueueItems(items, { status: "all", contentQuery: "타이틀" })).toHaveLength(1);
  });
});
