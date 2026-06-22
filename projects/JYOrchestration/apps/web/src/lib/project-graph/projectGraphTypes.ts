export const PROJECT_GRAPH_NODE_TYPES = {
  PROJECT: "Project",
  IDEA: "Idea",
  REQUIREMENT: "Requirement",
  FEATURE: "Feature",
  ACTOR: "Actor",
  SCREEN: "Screen",
  FLOW: "Flow",
  TASK: "Task",
  SPEC: "Spec",
  PROTOTYPE: "Prototype",
  REVIEW: "Review",
} as const;

export type ProjectGraphNodeType = (typeof PROJECT_GRAPH_NODE_TYPES)[keyof typeof PROJECT_GRAPH_NODE_TYPES];

export const PROJECT_GRAPH_EDGE_TYPES = {
  HAS_IDEA: "HAS_IDEA",
  HAS_REQUIREMENT: "HAS_REQUIREMENT",
  HAS_FEATURE: "HAS_FEATURE",
  IMPLEMENTED_BY: "IMPLEMENTED_BY",
  RELATED_TO: "RELATED_TO",
  USES: "USES",
  CONTAINS: "CONTAINS",
  NEXT: "NEXT",
  IMPLEMENTS: "IMPLEMENTS",
  REVIEWS: "REVIEWS",
} as const;

export type ProjectGraphEdgeType = (typeof PROJECT_GRAPH_EDGE_TYPES)[keyof typeof PROJECT_GRAPH_EDGE_TYPES];

/** Graph projection이 처리하는 이벤트 타입 (Event Store 타입 문자열과 동일) */
export const PROJECT_GRAPH_EVENT_TYPES = {
  PROJECT_CREATED: "project.created",
  IDEA_CREATED: "idea.created",
  CONVERSATION_MESSAGE_CREATED: "conversation.message_created",
  FEATURE_CREATED: "feature.created",
  PROTOTYPE_CREATED: "prototype.created",
  REVIEW_COMPLETED: "review.completed",
} as const;
