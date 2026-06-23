import type { ProjectGraphEventInput } from "@/lib/project-graph/projectGraphProjectionPlan";
import { PROJECT_GRAPH_EVENT_TYPES } from "@/lib/project-graph/projectGraphTypes";
import {
  parsePlanningSnapshotFromEventPayload,
  planStructureCandidatesFromPlanningSnapshot,
} from "@/lib/planning-snapshot/planningSnapshotStructurePlan";
import { parsePlanningProposalFromEventPayload } from "@/lib/planning-proposal/planningProposalMapper";
import { planStructureCandidatesFromPlanningProposal } from "@/lib/planning-proposal/planningProposalStructurePlan";
import type { StructureExtractionPlan } from "@/lib/project-structure/projectStructureExtractorPlan";

export type StructureCandidateHandler = (event: ProjectGraphEventInput) => StructureExtractionPlan | null;

function planningSnapshotStructureHandler(event: ProjectGraphEventInput): StructureExtractionPlan | null {
  const snapshot = parsePlanningSnapshotFromEventPayload(
    event.projectId,
    event.payload,
    event.sourceMessageId,
  );
  if (!snapshot) return null;
  return planStructureCandidatesFromPlanningSnapshot(event.id, snapshot);
}

function planningProposalStructureHandler(event: ProjectGraphEventInput): StructureExtractionPlan | null {
  const proposal = parsePlanningProposalFromEventPayload(
    event.projectId,
    event.payload,
    event.sourceMessageId,
  );
  if (!proposal) return null;
  return planStructureCandidatesFromPlanningProposal(event.id, proposal);
}

export const structureCandidateHandlers: Record<string, StructureCandidateHandler> = {
  [PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED]: planningSnapshotStructureHandler,
  [PROJECT_GRAPH_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED]: planningProposalStructureHandler,
};
