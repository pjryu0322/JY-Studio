import { describe, expect, it } from "vitest";

import {
  buildMemoryRuntimeEntriesFromTimelineMessages,
  extractDirectionalKeywordsFromTimelineMessages,
  pickRecentUserTextFromTimelineMessages,
} from "@/lib/harness/memoryRuntime/internal/timelineMemoryInputs";

describe("extractDirectionalKeywordsFromTimelineMessages", () => {
  it("returns empty for empty/null inputs", () => {
    expect(extractDirectionalKeywordsFromTimelineMessages([])).toEqual([]);
    expect(extractDirectionalKeywordsFromTimelineMessages(undefined)).toEqual([]);
  });

  it("detects seed keywords case-insensitively", () => {
    const out = extractDirectionalKeywordsFromTimelineMessages([
      "We need to migrate to a Microservice architecture",
      null,
      undefined,
    ]);
    expect(out).toContain("microservice");
  });

  it("dedupes seed keywords across messages", () => {
    const out = extractDirectionalKeywordsFromTimelineMessages([
      "monolith concerns",
      "still on a monolith",
    ]);
    expect(out.filter((s) => s === "monolith")).toHaveLength(1);
  });
});

describe("buildMemoryRuntimeEntriesFromTimelineMessages", () => {
  it("returns empty for empty/null inputs", () => {
    expect(buildMemoryRuntimeEntriesFromTimelineMessages([])).toEqual([]);
    expect(buildMemoryRuntimeEntriesFromTimelineMessages(undefined)).toEqual([]);
  });

  it("drops texts shorter than the min length and trims", () => {
    const out = buildMemoryRuntimeEntriesFromTimelineMessages(["hi", "  ", "valid message text"]);
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe("valid message text");
    expect(out[0]?.source).toMatch(/^MessengerPromptTimelineLog#/);
  });

  it("caps to a safe upper bound", () => {
    const msgs = Array.from({ length: 30 }, (_, i) => `message body number ${i}`);
    const out = buildMemoryRuntimeEntriesFromTimelineMessages(msgs);
    expect(out.length).toBeLessThanOrEqual(12);
  });
});

describe("pickRecentUserTextFromTimelineMessages", () => {
  it("returns null when no usable message", () => {
    expect(pickRecentUserTextFromTimelineMessages([])).toBeNull();
    expect(pickRecentUserTextFromTimelineMessages(["", "hi", null])).toBeNull();
  });

  it("returns the most recent usable message", () => {
    const out = pickRecentUserTextFromTimelineMessages([
      "older context here",
      null,
      "the latest user prompt",
    ]);
    expect(out).toBe("the latest user prompt");
  });
});
