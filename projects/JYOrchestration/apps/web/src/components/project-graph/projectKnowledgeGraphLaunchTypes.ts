/** Mini Preview → Modal → Workspace 경계용 (향후 Preview 확장) */
export type ProjectKnowledgeGraphOpenRequest = Readonly<{
  readonly projectId: string;
  readonly sourceMessageId?: string | null;
  readonly focusNodeId?: string | null;
  readonly view?: "activity" | "graph" | null;
}>;

export type ProjectKnowledgeGraphLaunchContext = Readonly<{
  readonly focusNodeId: string | null;
  readonly selectedNodeId: string | null;
  readonly activityView: boolean;
  readonly sourceMessageId: string | null;
}>;
