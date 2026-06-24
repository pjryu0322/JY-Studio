import type {
  ProjectGraphEventInput,
  ProjectGraphProjectionPlan,
} from "@/lib/project-graph/projectGraphProjectionPlan";
import { PROJECT_GRAPH_EVENT_TYPES } from "@/lib/project-graph/projectGraphTypes";
import { planGraphProjectionFromArtifactAdapter } from "@/lib/project-knowledge/projectKnowledgeArtifactAdapterRegistry";

export type ProjectGraphProjectionHandler = (
  event: ProjectGraphEventInput,
) => ProjectGraphProjectionPlan | null;

export function projectGraphProjectionHandlerFromAdapter(
  event: ProjectGraphEventInput,
): ProjectGraphProjectionPlan | null {
  return planGraphProjectionFromArtifactAdapter(event);
}

export const projectGraphProjectionHandlers: Record<string, ProjectGraphProjectionHandler> = {
  [PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED]: projectGraphProjectionHandlerFromAdapter,
  [PROJECT_GRAPH_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED]: projectGraphProjectionHandlerFromAdapter,
};
