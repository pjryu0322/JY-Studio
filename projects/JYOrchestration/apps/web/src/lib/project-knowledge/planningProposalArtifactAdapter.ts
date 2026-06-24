import type { PlanningProposalModel } from "@/lib/planning-proposal/planningProposalModel";
import { PLANNING_PROPOSAL_EVENT_TYPE } from "@/lib/planning-proposal/planningProposalModel";
import { parsePlanningProposalFromEventPayload } from "@/lib/planning-proposal/planningProposalMapper";
import { planProjectGraphProjectionFromPlanningProposal } from "@/lib/planning-proposal/planningProposalGraphPlan";
import { planStructureCandidatesFromPlanningProposal } from "@/lib/planning-proposal/planningProposalStructurePlan";
import type { ProjectKnowledgeArtifactAdapter } from "@/lib/project-knowledge/projectKnowledgeArtifactAdapter";
import { buildRequirementsConversationHref } from "@/lib/project-structure/projectStructureExplainability";

export const planningProposalArtifactAdapter: ProjectKnowledgeArtifactAdapter<PlanningProposalModel> = {
  eventType: PLANNING_PROPOSAL_EVENT_TYPE,

  parseEventPayload(input) {
    return parsePlanningProposalFromEventPayload(input.projectId, input.payload, input.sourceMessageId);
  },

  toStructureCandidates({ eventId, artifact }) {
    return planStructureCandidatesFromPlanningProposal(eventId, artifact);
  },

  toGraphProjection({ eventId, projectId, artifact }) {
    return planProjectGraphProjectionFromPlanningProposal(eventId, projectId, artifact);
  },

  toActivity({ eventId, artifact }) {
    return [
      {
        id: `proposal:${eventId}`,
        type: "event",
        title: "Proposal Approved",
        summary: artifact.acceptedSnapshot.split(/\n/)[0]?.trim().slice(0, 120) || artifact.proposalId,
        sourceEventId: eventId,
        sourceMessageId: artifact.sourceMessageId,
      },
    ];
  },

  toExplainability({ artifact }) {
    const href = buildRequirementsConversationHref(artifact.projectId, artifact.sourceMessageId);
    return {
      sourceConversation: {
        excerpt: artifact.acceptedSnapshot.slice(0, 240),
        messageId: artifact.sourceMessageId,
        href,
      },
      sourceEvent: { eventType: PLANNING_PROPOSAL_EVENT_TYPE, eventId: null },
      reason: "사용자가 AI 기획자 추천안을 승인(APPLY)하여 Knowledge Graph에 반영되었습니다.",
      confidence: 0.9,
      confidenceLabel: "HIGH",
      confidenceReason: "Explicit user approval",
      createdBy: "USER",
      createdFrom: {
        eventId: null,
        messageId: artifact.acceptedByMessageId || artifact.sourceMessageId,
      },
    };
  },
};
