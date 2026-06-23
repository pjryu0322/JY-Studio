import {
  buildEventEdgeProjectionKey,
  buildEventNodeProjectionKey,
  buildFeatureEntityKey,
  buildIdeaEntityKey,
  buildRequirementEntityKey,
  truncateGraphSummary,
} from "@/lib/project-graph/projectGraphKeys";
import { snapshotEntitySlug } from "@/lib/planning-snapshot/planningSnapshotMapper";
import type { PlanningProposalModel } from "@/lib/planning-proposal/planningProposalModel";
import { PLANNING_PROPOSAL_EVENT_TYPE } from "@/lib/planning-proposal/planningProposalModel";
import {
  PROJECT_GRAPH_EDGE_TYPES,
  PROJECT_GRAPH_NODE_TYPES,
} from "@/lib/project-graph/projectGraphTypes";
import type {
  ProjectGraphEdgePlan,
  ProjectGraphNodePlan,
  ProjectGraphProjectionPlan,
} from "@/lib/project-graph/projectGraphProjectionPlan";

function buildActorEntityKey(projectId: string, actorTitle: string): string {
  return `actor:${projectId}:${snapshotEntitySlug(actorTitle)}`;
}

function buildFlowEntityKey(projectId: string, flowTitle: string): string {
  return `flow:${projectId}:${snapshotEntitySlug(flowTitle)}`;
}

export function planProjectGraphProjectionFromPlanningProposal(
  eventId: string,
  projectId: string,
  proposal: PlanningProposalModel,
): ProjectGraphProjectionPlan {
  const nodes: ProjectGraphNodePlan[] = [];
  const edges: ProjectGraphEdgePlan[] = [];
  const ideaEntity = buildIdeaEntityKey(projectId);
  const ideaTitle = proposal.acceptedSnapshot.split(/\n/)[0]?.trim().slice(0, 120) || "승인된 제안";

  nodes.push({
    projectionKey: buildEventNodeProjectionKey(eventId, `${PROJECT_GRAPH_NODE_TYPES.IDEA}:proposal`),
    entityKey: ideaEntity,
    nodeType: PROJECT_GRAPH_NODE_TYPES.IDEA,
    title: ideaTitle,
    summary: truncateGraphSummary(proposal.acceptedSnapshot),
    metadata: {
      eventType: PLANNING_PROPOSAL_EVENT_TYPE,
      planningProposal: true,
      proposalId: proposal.proposalId,
      sourceMessageId: proposal.sourceMessageId,
      acceptedByMessageId: proposal.acceptedByMessageId,
    },
    sourceEventId: eventId,
  });

  for (const actor of proposal.actors) {
    const title = actor.slice(0, 120) || "Actor";
    const entity = buildActorEntityKey(projectId, title);
    nodes.push({
      projectionKey: buildEventNodeProjectionKey(eventId, `${PROJECT_GRAPH_NODE_TYPES.ACTOR}:${snapshotEntitySlug(title)}`),
      entityKey: entity,
      nodeType: PROJECT_GRAPH_NODE_TYPES.ACTOR,
      title,
      summary: truncateGraphSummary(actor),
      metadata: { planningProposal: true, sourceMessageId: proposal.sourceMessageId },
      sourceEventId: eventId,
    });
    edges.push({
      projectionKey: buildEventEdgeProjectionKey(eventId, PROJECT_GRAPH_EDGE_TYPES.RELATED_TO, entity),
      edgeType: PROJECT_GRAPH_EDGE_TYPES.RELATED_TO,
      fromEntityKey: ideaEntity,
      toEntityKey: entity,
      metadata: { planningProposal: true },
      sourceEventId: eventId,
    });
  }

  for (const flow of proposal.flows) {
    const title = flow.slice(0, 120) || "Flow";
    const slug = snapshotEntitySlug(title);
    const entity = buildFlowEntityKey(projectId, title);
    nodes.push({
      projectionKey: buildEventNodeProjectionKey(eventId, `${PROJECT_GRAPH_NODE_TYPES.FLOW}:${slug}`),
      entityKey: entity,
      nodeType: PROJECT_GRAPH_NODE_TYPES.FLOW,
      title,
      summary: truncateGraphSummary(flow),
      metadata: { planningProposal: true },
      sourceEventId: eventId,
    });
    edges.push({
      projectionKey: buildEventEdgeProjectionKey(eventId, PROJECT_GRAPH_EDGE_TYPES.NEXT, entity),
      edgeType: PROJECT_GRAPH_EDGE_TYPES.NEXT,
      fromEntityKey: ideaEntity,
      toEntityKey: entity,
      metadata: { planningProposal: true },
      sourceEventId: eventId,
    });
  }

  for (const feature of proposal.features) {
    const title = feature.slice(0, 120) || "Feature";
    const slug = snapshotEntitySlug(title);
    const featureEntity = buildFeatureEntityKey(projectId, `proposal:${slug}`);
    nodes.push({
      projectionKey: buildEventNodeProjectionKey(eventId, `${PROJECT_GRAPH_NODE_TYPES.FEATURE}:${slug}`),
      entityKey: featureEntity,
      nodeType: PROJECT_GRAPH_NODE_TYPES.FEATURE,
      title,
      summary: truncateGraphSummary(feature),
      metadata: { planningProposal: true },
      sourceEventId: eventId,
    });
    edges.push({
      projectionKey: buildEventEdgeProjectionKey(eventId, PROJECT_GRAPH_EDGE_TYPES.HAS_FEATURE, featureEntity),
      edgeType: PROJECT_GRAPH_EDGE_TYPES.HAS_FEATURE,
      fromEntityKey: ideaEntity,
      toEntityKey: featureEntity,
      metadata: { planningProposal: true },
      sourceEventId: eventId,
    });

    const reqTitle = `요구: ${title}`.slice(0, 120);
    const reqEntity = buildRequirementEntityKey(projectId, `proposal-req:${slug}`);
    nodes.push({
      projectionKey: buildEventNodeProjectionKey(eventId, `${PROJECT_GRAPH_NODE_TYPES.REQUIREMENT}:${slug}`),
      entityKey: reqEntity,
      nodeType: PROJECT_GRAPH_NODE_TYPES.REQUIREMENT,
      title: reqTitle,
      summary: truncateGraphSummary(feature),
      metadata: { planningProposal: true, relatedFeature: slug },
      sourceEventId: eventId,
    });
    edges.push({
      projectionKey: buildEventEdgeProjectionKey(eventId, PROJECT_GRAPH_EDGE_TYPES.HAS_REQUIREMENT, reqEntity),
      edgeType: PROJECT_GRAPH_EDGE_TYPES.HAS_REQUIREMENT,
      fromEntityKey: ideaEntity,
      toEntityKey: reqEntity,
      metadata: { planningProposal: true },
      sourceEventId: eventId,
    });
    edges.push({
      projectionKey: buildEventEdgeProjectionKey(eventId, PROJECT_GRAPH_EDGE_TYPES.IMPLEMENTS, featureEntity),
      edgeType: PROJECT_GRAPH_EDGE_TYPES.IMPLEMENTS,
      fromEntityKey: reqEntity,
      toEntityKey: featureEntity,
      metadata: { planningProposal: true },
      sourceEventId: eventId,
    });
  }

  for (const req of proposal.requirements) {
    const title = req.slice(0, 120) || "Requirement";
    const slug = snapshotEntitySlug(title);
    const reqEntity = buildRequirementEntityKey(projectId, `proposal-req-only:${slug}`);
    nodes.push({
      projectionKey: buildEventNodeProjectionKey(eventId, `${PROJECT_GRAPH_NODE_TYPES.REQUIREMENT}:only:${slug}`),
      entityKey: reqEntity,
      nodeType: PROJECT_GRAPH_NODE_TYPES.REQUIREMENT,
      title,
      summary: truncateGraphSummary(req),
      metadata: { planningProposal: true },
      sourceEventId: eventId,
    });
    edges.push({
      projectionKey: buildEventEdgeProjectionKey(eventId, PROJECT_GRAPH_EDGE_TYPES.HAS_REQUIREMENT, reqEntity),
      edgeType: PROJECT_GRAPH_EDGE_TYPES.HAS_REQUIREMENT,
      fromEntityKey: ideaEntity,
      toEntityKey: reqEntity,
      metadata: { planningProposal: true },
      sourceEventId: eventId,
    });
  }

  return { nodes, edges };
}
