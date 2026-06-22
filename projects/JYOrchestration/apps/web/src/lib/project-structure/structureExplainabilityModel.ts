import type { StructureCandidateExplainability } from "@/lib/project-structure/projectStructureExplainability";

export type StructureExplainabilityConfidenceLabel = "HIGH" | "MEDIUM" | "LOW";

export type StructureExplainabilitySourceConversation = Readonly<{
  readonly excerpt: string;
  readonly messageId: string | null;
  readonly href: string | null;
}>;

export type StructureExplainabilitySourceEvent = Readonly<{
  readonly eventType: string;
  readonly eventId: string | null;
}>;

export type StructureExplainabilityCreatedFrom = Readonly<{
  readonly eventId: string | null;
  readonly messageId: string | null;
}>;

/** Candidate·Graph Node 공통 Explainability 표준 모델 */
export type StructureExplainability = Readonly<{
  readonly sourceConversation: StructureExplainabilitySourceConversation;
  readonly sourceEvent: StructureExplainabilitySourceEvent;
  readonly reason: string;
  readonly confidence: number;
  readonly confidenceLabel: StructureExplainabilityConfidenceLabel;
  readonly createdBy: string;
  readonly createdFrom: StructureExplainabilityCreatedFrom;
}>;

export function normalizeConfidenceLabel(label: string): StructureExplainabilityConfidenceLabel {
  const u = String(label ?? "").trim().toUpperCase();
  if (u === "HIGH" || u === "H") return "HIGH";
  if (u === "MEDIUM" || u === "MED" || u === "M") return "MEDIUM";
  if (u === "LOW" || u === "L") return "LOW";
  if (label === "High") return "HIGH";
  if (label === "Medium") return "MEDIUM";
  if (label === "Low") return "LOW";
  return "MEDIUM";
}

export function formatConfidenceLabelForDisplay(label: StructureExplainabilityConfidenceLabel): string {
  switch (label) {
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    default:
      return "Low";
  }
}

export function toStructureExplainability(
  raw: StructureCandidateExplainability | StructureExplainability,
): StructureExplainability {
  return {
    sourceConversation: raw.sourceConversation,
    sourceEvent: raw.sourceEvent,
    reason: raw.reason,
    confidence: raw.confidence,
    confidenceLabel: normalizeConfidenceLabel(String(raw.confidenceLabel)),
    createdBy: raw.createdBy,
    createdFrom: raw.createdFrom,
  };
}
