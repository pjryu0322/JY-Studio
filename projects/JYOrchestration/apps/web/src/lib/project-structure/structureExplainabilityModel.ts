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

export type StructureExplainabilityRelatedNode = Readonly<{
  readonly nodeId: string;
  readonly nodeType: string;
  readonly title: string;
  readonly edgeType: string;
  readonly direction: "IN" | "OUT";
}>;

export type StructureExplainabilityRelatedArtifacts = Readonly<{
  readonly reviews: readonly StructureExplainabilityRelatedNode[];
  readonly screens: readonly StructureExplainabilityRelatedNode[];
  readonly features: readonly StructureExplainabilityRelatedNode[];
  readonly flows: readonly StructureExplainabilityRelatedNode[];
  readonly tasks: readonly StructureExplainabilityRelatedNode[];
  readonly changeRequests: readonly StructureExplainabilityRelatedNode[];
}>;

export const EMPTY_STRUCTURE_EXPLAINABILITY_ARTIFACTS: StructureExplainabilityRelatedArtifacts = {
  reviews: [],
  screens: [],
  features: [],
  flows: [],
  tasks: [],
  changeRequests: [],
};

/** Candidate·Graph Node 공통 Explainability 표준 모델 */
export type StructureExplainability = Readonly<{
  readonly sourceConversation: StructureExplainabilitySourceConversation;
  readonly sourceEvent: StructureExplainabilitySourceEvent;
  readonly reason: string;
  readonly confidence: number;
  readonly confidenceLabel: StructureExplainabilityConfidenceLabel;
  readonly confidenceReason: string;
  readonly createdBy: string;
  readonly createdFrom: StructureExplainabilityCreatedFrom;
  readonly relatedNodes: readonly StructureExplainabilityRelatedNode[];
  readonly relatedArtifacts: StructureExplainabilityRelatedArtifacts;
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

function groupRelatedArtifacts(
  relatedNodes: readonly StructureExplainabilityRelatedNode[],
): StructureExplainabilityRelatedArtifacts {
  const pick = (types: readonly string[]) =>
    relatedNodes.filter((n) => types.includes(n.nodeType));
  return {
    reviews: pick(["Review"]),
    screens: pick(["Screen"]),
    features: pick(["Feature"]),
    flows: pick(["Flow"]),
    tasks: pick(["Task"]),
    changeRequests: pick(["ChangeRequest", "Requirement"]),
  };
}

export function toStructureExplainability(
  raw: (StructureCandidateExplainability | StructureExplainability) & {
    readonly confidenceReason?: string;
    readonly relatedNodes?: readonly StructureExplainabilityRelatedNode[];
    readonly relatedArtifacts?: StructureExplainabilityRelatedArtifacts;
  },
): StructureExplainability {
  const relatedNodes = raw.relatedNodes ?? [];
  const relatedArtifacts = raw.relatedArtifacts ?? groupRelatedArtifacts(relatedNodes);
  return {
    sourceConversation: raw.sourceConversation,
    sourceEvent: raw.sourceEvent,
    reason: raw.reason,
    confidence: raw.confidence,
    confidenceLabel: normalizeConfidenceLabel(String(raw.confidenceLabel)),
    confidenceReason: String(raw.confidenceReason ?? ""),
    createdBy: raw.createdBy,
    createdFrom: raw.createdFrom,
    relatedNodes,
    relatedArtifacts,
  };
}

export function mergeExplainabilityContext(
  base: StructureExplainability,
  context: Readonly<{
    readonly confidenceReason?: string;
    readonly relatedNodes?: readonly StructureExplainabilityRelatedNode[];
  }>,
): StructureExplainability {
  const relatedNodes = context.relatedNodes ?? base.relatedNodes;
  return toStructureExplainability({
    ...base,
    confidenceReason: context.confidenceReason ?? base.confidenceReason,
    relatedNodes,
    relatedArtifacts: groupRelatedArtifacts(relatedNodes),
  });
}
