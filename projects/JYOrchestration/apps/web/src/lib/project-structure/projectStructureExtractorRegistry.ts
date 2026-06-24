import type { ProjectGraphEventInput } from "@/lib/project-graph/projectGraphProjectionPlan";
import type { StructureExtractionPlan } from "@/lib/project-structure/projectStructureExtractorPlan";
import { planStructureCandidatesFromArtifactAdapter } from "@/lib/project-knowledge/projectKnowledgeArtifactAdapterRegistry";
import { PROJECT_GRAPH_EVENT_TYPES } from "@/lib/project-graph/projectGraphTypes";

export type StructureCandidateHandler = (event: ProjectGraphEventInput) => StructureExtractionPlan | null;

export function structureCandidateHandlerFromAdapter(
  event: ProjectGraphEventInput,
): StructureExtractionPlan | null {
  return planStructureCandidatesFromArtifactAdapter(event);
}

export const structureCandidateHandlers: Record<string, StructureCandidateHandler> = {
  [PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED]: structureCandidateHandlerFromAdapter,
  [PROJECT_GRAPH_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED]: structureCandidateHandlerFromAdapter,
};
