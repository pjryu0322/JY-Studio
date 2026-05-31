import { describe, expect, it } from "vitest";
import {
  formatExecutionLogTimelineLabel,
  isExecutionLogTimelineEntry,
  pickExecutionLogTimelineEntries,
} from "@/lib/prototype/promptTimelineExecutionLogTabs";

describe("promptTimelineExecutionLogTabs", () => {
  it("filters implementation execution log entries", () => {
    const timeline = [
      {
        stage: "implementation",
        action: "task_cursor_api_started",
        source: "platform",
        responseText: "runId=abc",
        createdAt: "2026-05-30T12:00:00.000Z",
      },
      {
        stage: "ideation",
        action: "ideation_bootstrap",
        source: "platform",
        createdAt: "2026-05-30T12:01:00.000Z",
      },
    ];
    const logs = pickExecutionLogTimelineEntries(timeline);
    expect(logs).toHaveLength(1);
    expect(isExecutionLogTimelineEntry(logs[0]!)).toBe(true);
    expect(formatExecutionLogTimelineLabel(logs[0]!)).toBe("Cursor 작업 진행 중");
  });

  it("ignores null timeline entries", () => {
    const timeline = [
      null,
      {
        stage: "implementation",
        action: "task_cursor_api_completed",
        source: "platform",
        createdAt: "2026-05-30T12:02:00.000Z",
      },
    ] as const;
    expect(pickExecutionLogTimelineEntries(timeline)).toHaveLength(1);
    expect(isExecutionLogTimelineEntry(null)).toBe(false);
  });
});
