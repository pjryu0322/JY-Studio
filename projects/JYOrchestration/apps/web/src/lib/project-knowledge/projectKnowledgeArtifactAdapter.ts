import type { ProjectGraphProjectionPlan } from "@/lib/project-graph/projectGraphProjectionPlan";
import type { StructureExtractionPlan } from "@/lib/project-structure/projectStructureExtractorPlan";
import type { StructureExplainability } from "@/lib/project-structure/structureExplainabilityModel";
import type { ProjectKnowledgeActivityItem } from "@/lib/project-knowledge/projectKnowledgeActivityBuilder";

/** Adapter explainability partial (StructureExplainability 필드 subset) */
export type ProjectStructureExplainability = Partial<StructureExplainability>;

export interface ProjectKnowledgeArtifactAdapter<TArtifact> {
  eventType: string;

  parseEventPayload(input: {
    projectId: string;
    payload: unknown;
    sourceMessageId?: string | null;
  }): TArtifact | null;

  toStructureCandidates(input: {
    eventId: string;
    artifact: TArtifact;
  }): StructureExtractionPlan | null;

  toGraphProjection(input: {
    eventId: string;
    projectId: string;
    artifact: TArtifact;
  }): ProjectGraphProjectionPlan | null;

  toActivity(input: {
    eventId: string;
    artifact: TArtifact;
  }): ProjectKnowledgeActivityItem[];

  toExplainability(input: {
    artifact: TArtifact;
  }): ProjectStructureExplainability;
}
