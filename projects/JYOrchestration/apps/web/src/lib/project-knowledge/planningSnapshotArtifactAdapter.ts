import type { PlanningSnapshotModel } from "@/lib/planning-snapshot/planningSnapshotModel";
import { PLANNING_SNAPSHOT_EVENT_TYPE } from "@/lib/planning-snapshot/planningSnapshotModel";
import { planProjectGraphProjectionFromPlanningSnapshot } from "@/lib/planning-snapshot/planningSnapshotGraphPlan";
import {
  parsePlanningSnapshotFromEventPayload,
  planStructureCandidatesFromPlanningSnapshot,
} from "@/lib/planning-snapshot/planningSnapshotStructurePlan";
import type { ProjectKnowledgeArtifactAdapter } from "@/lib/project-knowledge/projectKnowledgeArtifactAdapter";
import { buildRequirementsConversationHref } from "@/lib/project-structure/projectStructureExplainability";

export const planningSnapshotArtifactAdapter: ProjectKnowledgeArtifactAdapter<PlanningSnapshotModel> = {
  eventType: PLANNING_SNAPSHOT_EVENT_TYPE,

  parseEventPayload(input) {
    return parsePlanningSnapshotFromEventPayload(input.projectId, input.payload, input.sourceMessageId);
  },

  toStructureCandidates({ eventId, artifact }) {
    return planStructureCandidatesFromPlanningSnapshot(eventId, artifact);
  },

  toGraphProjection({ eventId, projectId, artifact }) {
    return planProjectGraphProjectionFromPlanningSnapshot(eventId, projectId, artifact);
  },

  toActivity({ eventId, artifact }) {
    return [
      {
        id: `snapshot:${eventId}`,
        type: "event",
        title: "Snapshot Integrated",
        summary: artifact.productName || artifact.summary.slice(0, 120),
        sourceEventId: eventId,
        sourceMessageId: artifact.sourceMessageId,
      },
    ];
  },

  toExplainability({ artifact }) {
    const href = buildRequirementsConversationHref(artifact.projectId, artifact.sourceMessageId);
    return {
      sourceConversation: {
        excerpt: artifact.summary.slice(0, 240),
        messageId: artifact.sourceMessageId,
        href,
      },
      sourceEvent: { eventType: PLANNING_SNAPSHOT_EVENT_TYPE, eventId: null },
      reason: "AI Planner planning snapshot에서 구조 후보·그래프가 생성되었습니다.",
      confidence: 0.85,
      confidenceLabel: "HIGH",
      confidenceReason: "Planning Snapshot artifact",
      createdBy: artifact.createdBy,
      createdFrom: { eventId: null, messageId: artifact.sourceMessageId },
    };
  },
};
