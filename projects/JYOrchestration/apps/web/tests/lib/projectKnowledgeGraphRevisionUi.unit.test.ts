import { describe, expect, it } from "vitest";
import { formatKnowledgeRevisionTimelineLabel } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";

describe("formatKnowledgeRevisionTimelineLabel", () => {
  it("formats date without exposing ids", () => {
    const label = formatKnowledgeRevisionTimelineLabel("2026-06-24T10:10:00.000Z");
    expect(label).toMatch(/06\/24/);
    expect(label).toMatch(/\d{2}:\d{2}/);
  });
});
