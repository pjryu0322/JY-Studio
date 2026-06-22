import { describe, expect, it } from "vitest";
import {
  normalizeConfidenceLabel,
  toStructureExplainability,
} from "@/lib/project-structure/structureExplainabilityModel";
import { resolveExplainabilityForCandidateRow } from "@/lib/project-structure/projectStructureExplainabilityService";
import type { StructureCandidateRow } from "@/lib/project-structure/structureReviewUiTypes";

function cand(partial: Partial<StructureCandidateRow> & Pick<StructureCandidateRow, "id">): StructureCandidateRow {
  return {
    projectId: "p1",
    idempotencyKey: "k",
    nodeType: "Requirement",
    title: "t",
    summary: "s",
    lifecycleStatus: "CANDIDATE",
    sourceEventId: null,
    fingerprint: null,
    approvedGraphNodeId: null,
    metadata: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("structureExplainabilityModel", () => {
  it("normalizes API and legacy confidence labels", () => {
    expect(normalizeConfidenceLabel("High")).toBe("HIGH");
    expect(normalizeConfidenceLabel("MEDIUM")).toBe("MEDIUM");
    expect(normalizeConfidenceLabel("low")).toBe("LOW");
  });

  it("maps build output to standard model", () => {
    const ex = toStructureExplainability({
      confidence: 72,
      confidenceLabel: "Medium",
      reason: "r",
      sourceConversation: { excerpt: "x", messageId: null, href: null },
      sourceEvent: { eventType: "t", eventId: "e1" },
      createdBy: "AI",
      createdFrom: { eventId: "e1", messageId: null },
    });
    expect(ex.confidenceLabel).toBe("MEDIUM");
  });
});

describe("StructureExplainabilityPanel reuse", () => {
  it("resolveExplainabilityForCandidateRow matches panel input shape", () => {
    const row = cand({
      id: "1",
      explainability: {
        confidence: 55,
        confidenceLabel: "Medium",
        reason: "Derived from message",
        sourceConversation: { excerpt: "요구", messageId: null, href: null },
        sourceEvent: { eventType: "x", eventId: null },
        createdBy: "AI Structure Engine",
        createdFrom: { eventId: null, messageId: null },
      },
    });
    const ex = resolveExplainabilityForCandidateRow(row);
    expect(ex).not.toBeNull();
    expect(ex?.sourceConversation.excerpt).toContain("요구");
    expect(ex?.confidenceLabel).toBe("MEDIUM");
  });
});
