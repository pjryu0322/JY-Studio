export type ProjectKnowledgeTraceStepType =
  | "conversation"
  | "snapshot"
  | "proposal"
  | "event"
  | "candidate"
  | "projection"
  | "graph-node";

export type ProjectKnowledgeTraceStep = Readonly<{
  readonly id: string;
  readonly type: ProjectKnowledgeTraceStepType;
  readonly title: string;
  readonly summary?: string;
  readonly sourceEventId?: string;
  readonly sourceMessageId?: string;
  readonly sourceArtifactId?: string;
  readonly occurredAt?: string;
  readonly metadata?: Record<string, unknown>;
}>;

export type ProjectKnowledgeTraceResult = Readonly<{
  readonly nodeId: string;
  readonly lineage: readonly ProjectKnowledgeTraceStep[];
  readonly warnings: readonly string[];
}>;
