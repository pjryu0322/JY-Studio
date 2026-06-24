import { describe, expect, it } from "vitest";
import {
  formatKnowledgeRevisionChangeHintInline,
  formatKnowledgeRevisionDiffOverflowMessage,
  formatKnowledgeRevisionTimelineLabel,
  summarizeKnowledgeRevisionDiffLines,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";

describe("formatKnowledgeRevisionTimelineLabel", () => {
  it("formats date without exposing ids", () => {
    const label = formatKnowledgeRevisionTimelineLabel("2026-06-24T10:10:00.000Z");
    expect(label).toMatch(/06\/24/);
    expect(label).toMatch(/\d{2}:\d{2}/);
  });
});

describe("formatKnowledgeRevisionChangeHintInline", () => {
  it("joins diff lines for timeline cards", () => {
    const hint = formatKnowledgeRevisionChangeHintInline(["+ 항목 2개 추가", "+ 연결 3개 추가"]);
    expect(hint).toBe("항목 2개 추가 · 연결 3개 추가");
  });
});

describe("summarizeKnowledgeRevisionDiffLines", () => {
  it("limits visible diff lines and reports overflow", () => {
    const { visibleLines, overflowCount } = summarizeKnowledgeRevisionDiffLines([
      "+ 항목 1개 추가",
      "+ 연결 1개 추가",
      "+ 항목 2개 추가",
      "- 항목 1개 제거",
    ]);
    expect(visibleLines).toHaveLength(3);
    expect(overflowCount).toBe(1);
    expect(formatKnowledgeRevisionDiffOverflowMessage(overflowCount)).toBe("외 1개 변경 더 있음");
  });
});
