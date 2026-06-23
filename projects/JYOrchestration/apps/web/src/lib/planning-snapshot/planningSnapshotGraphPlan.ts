import {
  buildEventEdgeProjectionKey,
  buildEventNodeProjectionKey,
  buildFeatureEntityKey,
  buildIdeaEntityKey,
  buildProjectEntityKey,
  buildRequirementEntityKey,
  truncateGraphSummary,
} from "@/lib/project-graph/projectGraphKeys";
import { snapshotEntitySlug } from "@/lib/planning-snapshot/planningSnapshotMapper";
import type { PlanningSnapshotModel } from "@/lib/planning-snapshot/planningSnapshotModel";
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

export function planProjectGraphProjectionFromPlanningSnapshot(
  eventId: string,
  projectId: string,
  snapshot: PlanningSnapshotModel,
): ProjectGraphProjectionPlan {
  const nodes: ProjectGraphNodePlan[] = [];
  const edges: ProjectGraphEdgePlan[] = [];
  const ideaEntity = buildIdeaEntityKey(projectId);
  const projectEntity = buildProjectEntityKey(projectId);

  nodes.push({
    projectionKey: buildEventNodeProjectionKey(eventId, PROJECT_GRAPH_NODE_TYPES.IDEA),
    entityKey: ideaEntity,
    nodeType: PROJECT_GRAPH_NODE_TYPES.IDEA,
    title: snapshot.productName,
    summary: truncateGraphSummary(snapshot.summary),
    metadata: {
      eventType: "planning.snapshot_created",
      sourceMessageId: snapshot.sourceMessageId,
      planningSnapshot: true,
    },
    sourceEventId: eventId,
  });
  edges.push({
    projectionKey: buildEventEdgeProjectionKey(eventId, PROJECT_GRAPH_EDGE_TYPES.HAS_IDEA, ideaEntity),
    edgeType: PROJECT_GRAPH_EDGE_TYPES.HAS_IDEA,
    fromEntityKey: projectEntity,
    toEntityKey: ideaEntity,
    metadata: { planningSnapshot: true },
    sourceEventId: eventId,
  });

  for (const problem of snapshot.problems) {
    const title = problem.slice(0, 120) || "Problem";
    const slug = snapshotEntitySlug(title);
    const reqEntity = buildRequirementEntityKey(projectId, `snapshot-problem:${slug}`);
    nodes.push({
      projectionKey: buildEventNodeProjectionKey(eventId, `${PROJECT_GRAPH_NODE_TYPES.REQUIREMENT}:problem:${slug}`),
      entityKey: reqEntity,
      nodeType: PROJECT_GRAPH_NODE_TYPES.REQUIREMENT,
      title,
      summary: truncateGraphSummary(problem),
      metadata: {
        planningSnapshot: true,
        snapshotKind: "problem",
        sourceMessageId: snapshot.sourceMessageId,
      },
      sourceEventId: eventId,
    });
    edges.push({
      projectionKey: buildEventEdgeProjectionKey(eventId, PROJECT_GRAPH_EDGE_TYPES.HAS_REQUIREMENT, reqEntity),
      edgeType: PROJECT_GRAPH_EDGE_TYPES.HAS_REQUIREMENT,
      fromEntityKey: ideaEntity,
      toEntityKey: reqEntity,
      metadata: { planningSnapshot: true },
      sourceEventId: eventId,
    });
  }

  for (const actorTitle of snapshot.actors) {
    const title = actorTitle.slice(0, 120) || "Actor";
    const actorEntity = buildActorEntityKey(projectId, title);
    nodes.push({
      projectionKey: buildEventNodeProjectionKey(eventId, `${PROJECT_GRAPH_NODE_TYPES.ACTOR}:${snapshotEntitySlug(title)}`),
      entityKey: actorEntity,
      nodeType: PROJECT_GRAPH_NODE_TYPES.ACTOR,
      title,
      summary: title,
      metadata: {
        planningSnapshot: true,
        sourceMessageId: snapshot.sourceMessageId,
      },
      sourceEventId: eventId,
    });
    edges.push({
      projectionKey: buildEventEdgeProjectionKey(eventId, PROJECT_GRAPH_EDGE_TYPES.RELATED_TO, actorEntity),
      edgeType: PROJECT_GRAPH_EDGE_TYPES.RELATED_TO,
      fromEntityKey: ideaEntity,
      toEntityKey: actorEntity,
      metadata: { planningSnapshot: true, relation: "actor" },
      sourceEventId: eventId,
    });
  }

  for (const featureTitle of snapshot.features) {
    const title = featureTitle.slice(0, 120) || "Feature";
    const featureEntity = buildFeatureEntityKey(projectId, `snapshot:${snapshotEntitySlug(title)}`);
    nodes.push({
      projectionKey: buildEventNodeProjectionKey(eventId, `${PROJECT_GRAPH_NODE_TYPES.FEATURE}:${snapshotEntitySlug(title)}`),
      entityKey: featureEntity,
      nodeType: PROJECT_GRAPH_NODE_TYPES.FEATURE,
      title,
      summary: truncateGraphSummary(featureTitle),
      metadata: {
        planningSnapshot: true,
        sourceMessageId: snapshot.sourceMessageId,
      },
      sourceEventId: eventId,
    });
    edges.push({
      projectionKey: buildEventEdgeProjectionKey(eventId, PROJECT_GRAPH_EDGE_TYPES.HAS_FEATURE, featureEntity),
      edgeType: PROJECT_GRAPH_EDGE_TYPES.HAS_FEATURE,
      fromEntityKey: ideaEntity,
      toEntityKey: featureEntity,
      metadata: { planningSnapshot: true },
      sourceEventId: eventId,
    });
  }

  return { nodes, edges };
}
