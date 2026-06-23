import type { StructureCandidateExplainability } from "@/lib/project-structure/projectStructureExplainability";
import {
  buildRequirementsConversationHref,
  confidenceLabelFromScore,
  confidencePercentFromScore,
} from "@/lib/project-structure/projectStructureExplainability";
import { snapshotEntitySlug } from "@/lib/planning-snapshot/planningSnapshotMapper";
import { PLANNING_PROPOSAL_EVENT_TYPE, type PlanningProposalModel } from "@/lib/planning-proposal/planningProposalModel";
import {
  fingerprintStructureText,
  buildStructureCandidateEdgeKey,
  type StructureCandidateEdgeDraft,
  type StructureCandidateNodeDraft,
} from "@/lib/project-structure/projectStructureExtractorPlan";
import { STRUCTURE_CANDIDATE_NODE_TYPES } from "@/lib/project-structure/projectStructureTypes";
import { PROJECT_GRAPH_EDGE_TYPES } from "@/lib/project-graph/projectGraphTypes";

const PROPOSAL_REASON =
  "이 노드는 AI 기획자의 제안을 사용자가 \"추천안 적용\"으로 승인하여 생성되었습니다.";

function proposalExplainability(
  projectId: string,
  eventId: string,
  proposal: PlanningProposalModel,
): StructureCandidateExplainability {
  const score01 = 0.86;
  return {
    confidence: confidencePercentFromScore(score01),
    confidenceLabel: confidenceLabelFromScore(score01),
    reason: PROPOSAL_REASON,
    confidenceReason: "사용자가 추천안 적용(APPLY)으로 승인한 Planning Proposal 이벤트를 근거로 생성했습니다.",
    sourceConversation: {
      excerpt: proposal.acceptedSnapshot.slice(0, 280) || "AI 기획자 제안",
      messageId: proposal.sourceMessageId,
      href: buildRequirementsConversationHref(projectId, proposal.sourceMessageId),
    },
    sourceEvent: {
      eventType: PLANNING_PROPOSAL_EVENT_TYPE,
      eventId,
    },
    createdBy: proposal.createdBy,
    createdFrom: {
      eventId,
      messageId: proposal.sourceMessageId,
    },
  };
}

function nodeKey(eventId: string, nodeType: string, fingerprint: string): string {
  return `structure-candidate:event:${eventId}:node:${nodeType}:${fingerprint}`;
}

export function planStructureCandidatesFromPlanningProposal(
  eventId: string,
  proposal: PlanningProposalModel,
): { readonly nodes: StructureCandidateNodeDraft[]; readonly edges: StructureCandidateEdgeDraft[] } {
  const nodes: StructureCandidateNodeDraft[] = [];
  const edges: StructureCandidateEdgeDraft[] = [];
  const explainability = proposalExplainability(proposal.projectId, eventId, proposal);
  const ideaTitle = proposal.acceptedSnapshot.split(/\n/)[0]?.trim().slice(0, 120) || "승인된 제안";
  const ideaFp = fingerprintStructureText(STRUCTURE_CANDIDATE_NODE_TYPES.IDEA, ideaTitle, proposal.acceptedSnapshot.slice(0, 400));
  const ideaKey = nodeKey(eventId, STRUCTURE_CANDIDATE_NODE_TYPES.IDEA, ideaFp);

  nodes.push({
    idempotencyKey: ideaKey,
    nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.IDEA,
    title: ideaTitle,
    summary: proposal.acceptedSnapshot.slice(0, 500),
    sourceEventId: eventId,
    fingerprint: ideaFp,
    metadata: {
      planningProposal: true,
      proposalId: proposal.proposalId,
      acceptedByMessageId: proposal.acceptedByMessageId,
      sourceMessageId: proposal.sourceMessageId,
      explainability,
    },
  });

  const pushNode = (nodeType: string, title: string, summary: string, extraMeta?: Record<string, unknown>) => {
    const fp = fingerprintStructureText(nodeType, title, summary);
    const key = nodeKey(eventId, nodeType, fp);
    nodes.push({
      idempotencyKey: key,
      nodeType,
      title: title.slice(0, 120) || nodeType,
      summary,
      sourceEventId: eventId,
      fingerprint: fp,
      metadata: {
        planningProposal: true,
        proposalId: proposal.proposalId,
        sourceMessageId: proposal.sourceMessageId,
        acceptedByMessageId: proposal.acceptedByMessageId,
        explainability,
        ...extraMeta,
      },
    });
    edges.push({
      idempotencyKey: buildStructureCandidateEdgeKey(eventId, PROJECT_GRAPH_EDGE_TYPES.RELATED_TO, fp),
      fromIdempotencyKey: ideaKey,
      toIdempotencyKey: key,
      edgeType: PROJECT_GRAPH_EDGE_TYPES.RELATED_TO,
      sourceEventId: eventId,
      metadata: { planningProposal: true },
    });
    return key;
  };

  for (const actor of proposal.actors) {
    pushNode(STRUCTURE_CANDIDATE_NODE_TYPES.ACTOR, actor, actor);
  }
  for (const flow of proposal.flows) {
    pushNode(STRUCTURE_CANDIDATE_NODE_TYPES.FLOW, flow.slice(0, 80), flow);
  }
  for (const req of proposal.requirements) {
    pushNode(STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT, req.slice(0, 120), req);
  }
  for (const feature of proposal.features) {
    const featureKey = pushNode(STRUCTURE_CANDIDATE_NODE_TYPES.FEATURE, feature, feature);
    const reqTitle = `요구: ${feature}`.slice(0, 120);
    const reqFp = fingerprintStructureText(STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT, reqTitle, feature);
    const reqKey = nodeKey(eventId, STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT, reqFp);
    nodes.push({
      idempotencyKey: reqKey,
      nodeType: STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT,
      title: reqTitle,
      summary: feature,
      sourceEventId: eventId,
      fingerprint: reqFp,
      metadata: {
        planningProposal: true,
        proposalId: proposal.proposalId,
        sourceMessageId: proposal.sourceMessageId,
        explainability,
        relatedFeatureFingerprint: reqFp,
      },
    });
    edges.push({
      idempotencyKey: buildStructureCandidateEdgeKey(eventId, PROJECT_GRAPH_EDGE_TYPES.IMPLEMENTS, reqFp),
      fromIdempotencyKey: reqKey,
      toIdempotencyKey: featureKey,
      edgeType: PROJECT_GRAPH_EDGE_TYPES.IMPLEMENTS,
      sourceEventId: eventId,
      metadata: { planningProposal: true },
    });
  }

  for (const d of proposal.decisions) {
    pushNode(STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT, `[결정] ${d}`.slice(0, 120), d, { proposalField: "decision" });
  }
  for (const a of proposal.assumptions) {
    pushNode(STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT, `[가정] ${a}`.slice(0, 120), a, { proposalField: "assumption" });
  }
  for (const inc of proposal.scope.included) {
    pushNode(STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT, `[범위 포함] ${inc}`.slice(0, 120), inc, { proposalField: "scope_included" });
  }
  for (const exc of proposal.scope.excluded) {
    pushNode(STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT, `[범위 제외] ${exc}`.slice(0, 120), exc, { proposalField: "scope_excluded" });
  }

  return { nodes, edges };
}
