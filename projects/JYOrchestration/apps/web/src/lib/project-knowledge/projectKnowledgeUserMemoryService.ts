import {
  PROJECT_KNOWLEDGE_AGENTS,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { collectUserProjectKnowledgeMemory } from "@/lib/project-knowledge/projectKnowledgeUserMemoryCollector";
import { buildUserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptContext";
import { listSameUserProjectKnowledgeMemorySources } from "@/lib/project-knowledge/projectKnowledgeUserMemorySourceQuery";
import type {
  UserProjectKnowledgeAgentPromptContext,
  UserProjectKnowledgeMemorySourceProject,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import { normalizeUserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import {
  applyAgentEnabledToMemoryContexts,
  applyUserProjectKnowledgeMemoryControlToPrepareInput,
  emptyUserProjectKnowledgeMemoryContextsByAgent,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlService";

export async function prepareUserProjectKnowledgeMemoryContext(input: {
  readonly userId: string;
  readonly targetProjectId?: string;
  readonly sourceProjects: readonly UserProjectKnowledgeMemorySourceProject[];
  readonly excludedSourceProjectIds?: readonly string[];
  readonly ignoredMemoryItemIds?: readonly string[];
  readonly pinnedMemoryItemIds?: readonly string[];
  readonly maxItemsPerAgent?: number;
  readonly minRelevance?: number;
}): Promise<{
  readonly byAgent: Readonly<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>>;
  readonly totalItemCount: number;
}> {
  const collected = collectUserProjectKnowledgeMemory({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    sourceProjects: input.sourceProjects,
    excludedSourceProjectIds: input.excludedSourceProjectIds,
    ignoredMemoryItemIds: input.ignoredMemoryItemIds,
    pinnedMemoryItemIds: input.pinnedMemoryItemIds,
    maxItemsPerAgent: input.maxItemsPerAgent,
    minRelevance: input.minRelevance,
  });

  const byAgent = {} as Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>;
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    byAgent[agent] = buildUserProjectKnowledgeAgentPromptContext({
      agent,
      items: collected.byAgent[agent],
      maxItems: input.maxItemsPerAgent,
    });
  }

  return {
    byAgent,
    totalItemCount: collected.totalItemCount,
  };
}

export async function prepareSameUserProjectKnowledgeMemoryPromptContexts(input: {
  readonly userId: string;
  readonly targetProjectId?: string;
  readonly excludedSourceProjectIds?: readonly string[];
  readonly ignoredMemoryItemIds?: readonly string[];
  readonly pinnedMemoryItemIds?: readonly string[];
  readonly maxItemsPerAgent?: number;
  readonly minRelevance?: number;
  readonly limitProjects?: number;
  readonly control?: UserProjectKnowledgeMemoryControlV1 | null;
}): Promise<{
  readonly byAgent: Readonly<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>>;
  readonly totalItemCount: number;
  readonly sourceProjectCount: number;
  readonly memoryControlEnabled: boolean;
}> {
  const control = normalizeUserProjectKnowledgeMemoryControlV1(input.control);
  const apply = applyUserProjectKnowledgeMemoryControlToPrepareInput({
    control,
    base: {
      excludedSourceProjectIds: input.excludedSourceProjectIds,
      ignoredMemoryItemIds: input.ignoredMemoryItemIds,
      pinnedMemoryItemIds: input.pinnedMemoryItemIds,
    },
  });

  if (apply.disabled) {
    return {
      byAgent: emptyUserProjectKnowledgeMemoryContextsByAgent(),
      totalItemCount: 0,
      sourceProjectCount: 0,
      memoryControlEnabled: false,
    };
  }

  const sourceProjects = await listSameUserProjectKnowledgeMemorySources({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    limitProjects: input.limitProjects,
  });

  const prepared = await prepareUserProjectKnowledgeMemoryContext({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    sourceProjects,
    excludedSourceProjectIds: apply.excludedSourceProjectIds,
    ignoredMemoryItemIds: apply.ignoredMemoryItemIds,
    pinnedMemoryItemIds: apply.pinnedMemoryItemIds,
    maxItemsPerAgent: input.maxItemsPerAgent,
    minRelevance: input.minRelevance,
  });

  const byAgent = applyAgentEnabledToMemoryContexts({ control, byAgent: prepared.byAgent });
  const totalItemCount = PROJECT_KNOWLEDGE_AGENTS.reduce(
    (sum, agent) => sum + (byAgent[agent]?.itemCount ?? 0),
    0,
  );

  return {
    byAgent,
    totalItemCount,
    sourceProjectCount: sourceProjects.length,
    memoryControlEnabled: true,
  };
}
