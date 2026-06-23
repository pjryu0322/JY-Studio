import type {
  ProjectGraphEventInput,
  ProjectGraphProjectionPlan,
} from "@/lib/project-graph/projectGraphProjectionPlan";
import { PROJECT_GRAPH_EVENT_TYPES } from "@/lib/project-graph/projectGraphTypes";
import { planProjectGraphProjectionFromPlanningSnapshot } from "@/lib/planning-snapshot/planningSnapshotGraphPlan";
import { parsePlanningSnapshotFromEventPayload } from "@/lib/planning-snapshot/planningSnapshotStructurePlan";
import { parsePlanningProposalFromEventPayload } from "@/lib/planning-proposal/planningProposalMapper";
import { planProjectGraphProjectionFromPlanningProposal } from "@/lib/planning-proposal/planningProposalGraphPlan";

export type ProjectGraphProjectionHandler = (
  event: ProjectGraphEventInput,
) => ProjectGraphProjectionPlan | null;

function planningSnapshotGraphHandler(event: ProjectGraphEventInput): ProjectGraphProjectionPlan | null {
  const snapshot = parsePlanningSnapshotFromEventPayload(
    event.projectId,
    event.payload,
    event.sourceMessageId,
  );
  if (!snapshot) return null;
  return planProjectGraphProjectionFromPlanningSnapshot(event.id, event.projectId, snapshot);
}

function planningProposalGraphHandler(event: ProjectGraphEventInput): ProjectGraphProjectionPlan | null {
  const proposal = parsePlanningProposalFromEventPayload(
    event.projectId,
    event.payload,
    event.sourceMessageId,
  );
  if (!proposal) return null;
  return planProjectGraphProjectionFromPlanningProposal(event.id, event.projectId, proposal);
}

export const projectGraphProjectionHandlers: Record<string, ProjectGraphProjectionHandler> = {
  [PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED]: planningSnapshotGraphHandler,
  [PROJECT_GRAPH_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED]: planningProposalGraphHandler,
};
