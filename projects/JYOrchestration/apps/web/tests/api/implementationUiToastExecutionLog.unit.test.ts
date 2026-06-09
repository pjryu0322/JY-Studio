import { describe, expect, it } from "vitest";
import { buildImplementationUiToastTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import { appendImplementationUiToastToPromptTimeline } from "@/lib/prototype/implementationUiToastExecutionLog";
import {
  formatExecutionLogTimelineLabel,
  isExecutionLogTimelineEntry,
  isPersistentExecutionLogTimelineEntry,
  pickExecutionLogTimelineEntries,
} from "@/lib/prototype/promptTimelineExecutionLogTabs";

describe("implementation UI toast execution log", () => {
  it("appends persistent implementation_ui_toast entries", () => {
    const timeline = appendImplementationUiToastToPromptTimeline({
      priorTimeline: [],
      projectId: "proj-1",
      message: "통합 branch 생성 및 Preview 준비 중…",
    });
    expect(timeline).toHaveLength(1);
    const entry = timeline[0]!;
    expect(entry.action).toBe("implementation_ui_toast");
    expect(isPersistentExecutionLogTimelineEntry(entry)).toBe(true);
    expect(isExecutionLogTimelineEntry(entry)).toBe(true);
    expect(pickExecutionLogTimelineEntries(timeline)).toHaveLength(1);
    expect(formatExecutionLogTimelineLabel(entry)).toBe("통합 branch 생성 및 Preview 준비 중…");
  });

  it("stores toast text on promptText when response fields are incomplete", () => {
    const entry = buildImplementationUiToastTimelineEntry({
      projectId: "proj-1",
      message: "Preview=a=b 테스트",
    });
    expect(entry.promptText).toBe("Preview=a=b 테스트");
    expect(formatExecutionLogTimelineLabel(entry)).toBe("Preview=a=b 테스트");
  });
});
