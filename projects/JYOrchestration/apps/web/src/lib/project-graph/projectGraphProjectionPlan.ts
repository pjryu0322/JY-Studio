import {
  buildEventEdgeProjectionKey,
  buildEventNodeProjectionKey,
  buildFeatureEntityKey,
  buildIdeaEntityKey,
  buildProjectEntityKey,
  buildPrototypeEntityKey,
  buildRequirementEntityKey,
  buildReviewEntityKey,
  defaultProjectNodeTitle,
  truncateGraphSummary,
} from "@/lib/project-graph/projectGraphKeys";
import {
  PROJECT_GRAPH_EDGE_TYPES,
  PROJECT_GRAPH_EVENT_TYPES,
  PROJECT_GRAPH_NODE_TYPES,
} from "@/lib/project-graph/projectGraphTypes";

export type ProjectGraphEventInput = Readonly<{
  readonly id: string;
  readonly projectId: string;
  readonly eventType: string;
  readonly payload: unknown;
  readonly sourceMessageId?: string | null;
  readonly stage?: string | null;
  readonly messageContent?: string | null;
}>;

export type ProjectGraphNodePlan = Readonly<{
  readonly projectionKey: string;
  readonly entityKey: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary: string;
  readonly metadata: Record<string, unknown>;
  readonly sourceEventId: string;
}>;

export type ProjectGraphEdgePlan = Readonly<{
  readonly projectionKey: string;
  readonly edgeType: string;
  readonly fromEntityKey: string;
  readonly toEntityKey: string;
  readonly metadata: Record<string, unknown>;
  readonly sourceEventId: string;
}>;

export type ProjectGraphProjectionPlan = Readonly<{
  readonly nodes: readonly ProjectGraphNodePlan[];
  readonly edges: readonly ProjectGraphEdgePlan[];
}>;

function asPayloadRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  return payload as Record<string, unknown>;
}

function readString(payload: Record<string, unknown>, key: string): string {
  return String(payload[key] ?? "").trim();
}

export function planProjectGraphProjectionFromEvent(event: ProjectGraphEventInput): ProjectGraphProjectionPlan {
  const payload = asPayloadRecord(event.payload);
  const nodes: ProjectGraphNodePlan[] = [];
  const edges: ProjectGraphEdgePlan[] = [];

  switch (event.eventType) {
    case PROJECT_GRAPH_EVENT_TYPES.PROJECT_CREATED: {
      const entityKey = buildProjectEntityKey(event.projectId);
      nodes.push({
        projectionKey: buildEventNodeProjectionKey(event.id, PROJECT_GRAPH_NODE_TYPES.PROJECT),
        entityKey,
        nodeType: PROJECT_GRAPH_NODE_TYPES.PROJECT,
        title: defaultProjectNodeTitle(payload),
        summary: readString(payload, "projectType"),
        metadata: { eventType: event.eventType, stage: event.stage ?? null },
        sourceEventId: event.id,
      });
      break;
    }
    case PROJECT_GRAPH_EVENT_TYPES.IDEA_CREATED: {
      const ideaEntity = buildIdeaEntityKey(event.projectId);
      const description = readString(payload, "description");
      nodes.push({
        projectionKey: buildEventNodeProjectionKey(event.id, PROJECT_GRAPH_NODE_TYPES.IDEA),
        entityKey: ideaEntity,
        nodeType: PROJECT_GRAPH_NODE_TYPES.IDEA,
        title: readString(payload, "name") || "Idea",
        summary: truncateGraphSummary(description),
        metadata: { eventType: event.eventType },
        sourceEventId: event.id,
      });
      edges.push({
        projectionKey: buildEventEdgeProjectionKey(
          event.id,
          PROJECT_GRAPH_EDGE_TYPES.HAS_IDEA,
          ideaEntity,
        ),
        edgeType: PROJECT_GRAPH_EDGE_TYPES.HAS_IDEA,
        fromEntityKey: buildProjectEntityKey(event.projectId),
        toEntityKey: ideaEntity,
        metadata: {},
        sourceEventId: event.id,
      });
      break;
    }
    case PROJECT_GRAPH_EVENT_TYPES.CONVERSATION_MESSAGE_CREATED: {
      const sourceMessageId =
        readString(payload, "sourceMessageId") || String(event.sourceMessageId ?? "").trim();
      if (!sourceMessageId) break;
      const reqEntity = buildRequirementEntityKey(event.projectId, sourceMessageId);
      const content = truncateGraphSummary(event.messageContent ?? "");
      nodes.push({
        projectionKey: buildEventNodeProjectionKey(event.id, PROJECT_GRAPH_NODE_TYPES.REQUIREMENT),
        entityKey: reqEntity,
        nodeType: PROJECT_GRAPH_NODE_TYPES.REQUIREMENT,
        title: content.slice(0, 120) || "Requirement",
        summary: content,
        metadata: {
          eventType: event.eventType,
          sourceMessageId,
          stage: event.stage ?? (readString(payload, "stage") || null),
        },
        sourceEventId: event.id,
      });
      edges.push({
        projectionKey: buildEventEdgeProjectionKey(
          event.id,
          PROJECT_GRAPH_EDGE_TYPES.HAS_REQUIREMENT,
          reqEntity,
        ),
        edgeType: PROJECT_GRAPH_EDGE_TYPES.HAS_REQUIREMENT,
        fromEntityKey: buildIdeaEntityKey(event.projectId),
        toEntityKey: reqEntity,
        metadata: { sourceMessageId },
        sourceEventId: event.id,
      });
      break;
    }
    case PROJECT_GRAPH_EVENT_TYPES.FEATURE_CREATED: {
      const featureId = readString(payload, "featureId") || readString(payload, "id") || event.id;
      const featureEntity = buildFeatureEntityKey(event.projectId, featureId);
      nodes.push({
        projectionKey: buildEventNodeProjectionKey(event.id, PROJECT_GRAPH_NODE_TYPES.FEATURE),
        entityKey: featureEntity,
        nodeType: PROJECT_GRAPH_NODE_TYPES.FEATURE,
        title: readString(payload, "title") || "Feature",
        summary: truncateGraphSummary(readString(payload, "summary") || readString(payload, "description")),
        metadata: { featureId, eventType: event.eventType },
        sourceEventId: event.id,
      });
      const requirementId = readString(payload, "requirementId") || readString(payload, "sourceMessageId");
      if (requirementId) {
        edges.push({
          projectionKey: buildEventEdgeProjectionKey(
            event.id,
            PROJECT_GRAPH_EDGE_TYPES.HAS_FEATURE,
            featureEntity,
          ),
          edgeType: PROJECT_GRAPH_EDGE_TYPES.HAS_FEATURE,
          fromEntityKey: buildRequirementEntityKey(event.projectId, requirementId),
          toEntityKey: featureEntity,
          metadata: { featureId },
          sourceEventId: event.id,
        });
      }
      break;
    }
    case PROJECT_GRAPH_EVENT_TYPES.PROTOTYPE_CREATED: {
      const prototypeId = readString(payload, "prototypeId") || readString(payload, "id") || event.id;
      const protoEntity = buildPrototypeEntityKey(event.projectId, prototypeId);
      nodes.push({
        projectionKey: buildEventNodeProjectionKey(event.id, PROJECT_GRAPH_NODE_TYPES.PROTOTYPE),
        entityKey: protoEntity,
        nodeType: PROJECT_GRAPH_NODE_TYPES.PROTOTYPE,
        title: readString(payload, "title") || "Prototype",
        summary: truncateGraphSummary(readString(payload, "summary")),
        metadata: { prototypeId, eventType: event.eventType },
        sourceEventId: event.id,
      });
      const featureId = readString(payload, "featureId");
      if (featureId) {
        edges.push({
          projectionKey: buildEventEdgeProjectionKey(
            event.id,
            PROJECT_GRAPH_EDGE_TYPES.IMPLEMENTED_BY,
            protoEntity,
          ),
          edgeType: PROJECT_GRAPH_EDGE_TYPES.IMPLEMENTED_BY,
          fromEntityKey: buildFeatureEntityKey(event.projectId, featureId),
          toEntityKey: protoEntity,
          metadata: { prototypeId },
          sourceEventId: event.id,
        });
      }
      break;
    }
    case PROJECT_GRAPH_EVENT_TYPES.REVIEW_COMPLETED: {
      const reviewId = readString(payload, "reviewId") || readString(payload, "id") || event.id;
      const reviewEntity = buildReviewEntityKey(event.projectId, reviewId);
      nodes.push({
        projectionKey: buildEventNodeProjectionKey(event.id, PROJECT_GRAPH_NODE_TYPES.REVIEW),
        entityKey: reviewEntity,
        nodeType: PROJECT_GRAPH_NODE_TYPES.REVIEW,
        title: readString(payload, "title") || "Review",
        summary: truncateGraphSummary(readString(payload, "summary") || readString(payload, "verdict")),
        metadata: { reviewId, eventType: event.eventType },
        sourceEventId: event.id,
      });
      const prototypeId = readString(payload, "prototypeId");
      if (prototypeId) {
        edges.push({
          projectionKey: buildEventEdgeProjectionKey(
            event.id,
            PROJECT_GRAPH_EDGE_TYPES.REVIEWS,
            reviewEntity,
          ),
          edgeType: PROJECT_GRAPH_EDGE_TYPES.REVIEWS,
          fromEntityKey: buildPrototypeEntityKey(event.projectId, prototypeId),
          toEntityKey: reviewEntity,
          metadata: { reviewId },
          sourceEventId: event.id,
        });
      }
      break;
    }
    default:
      break;
  }

  return { nodes, edges };
}
