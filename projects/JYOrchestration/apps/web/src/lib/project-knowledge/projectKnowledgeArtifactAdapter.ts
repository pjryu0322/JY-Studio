import type { ProjectGraphProjectionPlan } from "@/lib/project-graph/projectGraphProjectionPlan";
import type { StructureExtractionPlan } from "@/lib/project-structure/projectStructureExtractorPlan";

/** 향후 Snapshot / Proposal 등 Knowledge Artifact별 공통 변환 계약 */
export type ProjectKnowledgeArtifactAdapter<TArtifact> = {
  eventType: string;
  parseEventPayload(input: {
    projectId: string;
    payload: unknown;
    sourceMessageId?: string | null;
  }): TArtifact | null;
  toStructureCandidates(input: {
    eventId: string;
    artifact: TArtifact;
  }): StructureExtractionPlan;
  toGraphProjection(input: {
    eventId: string;
    projectId: string;
    artifact: TArtifact;
  }): ProjectGraphProjectionPlan;
};
