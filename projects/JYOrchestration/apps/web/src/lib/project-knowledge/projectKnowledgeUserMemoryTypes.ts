import type {
  AgentKnowledgeUse,
  ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";

export type UserProjectKnowledgeMemoryScope = "same_user";

export type UserProjectKnowledgeMemoryLifecycle =
  | "AUTO_CAPTURED"
  | "USED"
  | "PINNED"
  | "IGNORED"
  | "STALE";

export type UserProjectKnowledgeMemoryItem = Readonly<{
  readonly id: string;
  readonly sourceProjectId: string;
  readonly sourceProjectTitle?: string;
  readonly sourceNodeId: string;
  readonly nodeType: string;
  readonly title: string;
  readonly summary: string;
  readonly confidence?: number;
  readonly lifecycle: UserProjectKnowledgeMemoryLifecycle;
  readonly scope: UserProjectKnowledgeMemoryScope;
  readonly agent: ProjectKnowledgeAgent;
  readonly relevance: number;
  readonly useAs: AgentKnowledgeUse["useAs"];
  readonly reason: string;
  readonly promptSummary: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}>;

export type UserProjectKnowledgeAgentMemoryBundle = Readonly<{
  readonly userId: string;
  readonly targetProjectId?: string;
  readonly agent: ProjectKnowledgeAgent;
  readonly items: readonly UserProjectKnowledgeMemoryItem[];
  readonly excludedSourceProjectIds: readonly string[];
  readonly generatedAt: string;
}>;

export type UserProjectKnowledgeAgentPromptContext = Readonly<{
  readonly agent: ProjectKnowledgeAgent;
  readonly sectionTitle: string;
  readonly markdown: string;
  readonly itemCount: number;
  readonly sourceProjectCount: number;
}>;

export type UserProjectKnowledgeMemorySourceProject = Readonly<{
  readonly projectId: string;
  readonly projectTitle?: string;
  readonly ownerUserId: string;
  readonly nodes: readonly ProjectGraphNodeDto[];
  readonly updatedAt?: string;
}>;

export type CollectUserProjectKnowledgeMemoryInput = Readonly<{
  readonly userId: string;
  readonly targetProjectId?: string;
  readonly sourceProjects: readonly UserProjectKnowledgeMemorySourceProject[];
  readonly agent?: ProjectKnowledgeAgent;
  readonly maxItemsPerAgent?: number;
  readonly minRelevance?: number;
  readonly excludedSourceProjectIds?: readonly string[];
  readonly ignoredMemoryItemIds?: readonly string[];
  readonly pinnedMemoryItemIds?: readonly string[];
}>;

export type CollectUserProjectKnowledgeMemoryResult = Readonly<{
  readonly byAgent: Readonly<Record<ProjectKnowledgeAgent, readonly UserProjectKnowledgeMemoryItem[]>>;
  readonly excludedSourceProjectIds: readonly string[];
  readonly totalItemCount: number;
}>;
