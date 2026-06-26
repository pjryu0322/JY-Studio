import type { ProjectGraphNodeDto } from "@/lib/project-graph/projectGraphClient";
import {
  DEFAULT_AGENT_PROMPT_RELEVANCE_THRESHOLD,
  PROJECT_KNOWLEDGE_AGENTS,
  getAgentPromptSummary,
  getAgentRelevance,
  isAgentPromptRelevant,
  sanitizeAgentKnowledgeText,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import type {
  CollectUserProjectKnowledgeMemoryInput,
  CollectUserProjectKnowledgeMemoryResult,
  UserProjectKnowledgeMemoryItem,
  UserProjectKnowledgeMemoryLifecycle,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

export const DEFAULT_USER_MEMORY_MAX_ITEMS_PER_AGENT = 8;

export function buildUserProjectKnowledgeMemoryItemId(
  sourceProjectId: string,
  sourceNodeId: string,
  agent: ProjectKnowledgeAgent,
): string {
  return `${sourceProjectId}:${sourceNodeId}:${agent}`;
}

function emptyByAgent(): Record<ProjectKnowledgeAgent, UserProjectKnowledgeMemoryItem[]> {
  const out = {} as Record<ProjectKnowledgeAgent, UserProjectKnowledgeMemoryItem[]>;
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    out[agent] = [];
  }
  return out;
}

function buildNodeSummary(node: ProjectGraphNodeDto): string {
  const fromSummary = sanitizeAgentKnowledgeText(node.summary ?? "");
  if (fromSummary) return fromSummary;
  return sanitizeAgentKnowledgeText(node.title);
}

function buildNodeTitle(node: ProjectGraphNodeDto): string {
  return sanitizeAgentKnowledgeText(node.title) || "Knowledge node";
}

function compareMemoryItems(a: UserProjectKnowledgeMemoryItem, b: UserProjectKnowledgeMemoryItem): number {
  const aPinned = a.lifecycle === "PINNED";
  const bPinned = b.lifecycle === "PINNED";
  if (aPinned !== bPinned) return aPinned ? -1 : 1;
  if (b.relevance !== a.relevance) return b.relevance - a.relevance;
  const aTime = a.updatedAt ?? a.createdAt ?? "";
  const bTime = b.updatedAt ?? b.createdAt ?? "";
  if (bTime !== aTime) return bTime.localeCompare(aTime);
  if (a.sourceProjectId !== b.sourceProjectId) {
    return a.sourceProjectId.localeCompare(b.sourceProjectId);
  }
  return a.sourceNodeId.localeCompare(b.sourceNodeId);
}

function createMemoryItem(input: {
  readonly sourceProjectId: string;
  readonly sourceProjectTitle?: string;
  readonly sourceUpdatedAt?: string;
  readonly node: ProjectGraphNodeDto;
  readonly agent: ProjectKnowledgeAgent;
  readonly lifecycle: UserProjectKnowledgeMemoryLifecycle;
}): UserProjectKnowledgeMemoryItem | null {
  const use = getAgentRelevance(input.node, input.agent);
  if (!use) return null;
  const promptSummary = getAgentPromptSummary(input.node, input.agent);
  if (!promptSummary) return null;

  const id = buildUserProjectKnowledgeMemoryItemId(
    input.sourceProjectId,
    input.node.id,
    input.agent,
  );

  return {
    id,
    sourceProjectId: input.sourceProjectId,
    ...(input.sourceProjectTitle ? { sourceProjectTitle: input.sourceProjectTitle } : {}),
    sourceNodeId: input.node.id,
    nodeType: String(input.node.nodeType ?? "").trim() || "Unknown",
    title: buildNodeTitle(input.node),
    summary: buildNodeSummary(input.node),
    lifecycle: input.lifecycle,
    scope: "same_user",
    agent: input.agent,
    relevance: use.relevance,
    useAs: use.useAs,
    reason: use.reason,
    promptSummary,
    ...(input.sourceUpdatedAt ? { updatedAt: input.sourceUpdatedAt, createdAt: input.sourceUpdatedAt } : {}),
  };
}

export function collectUserProjectKnowledgeMemory(
  input: CollectUserProjectKnowledgeMemoryInput,
): CollectUserProjectKnowledgeMemoryResult {
  const minRelevance = input.minRelevance ?? DEFAULT_AGENT_PROMPT_RELEVANCE_THRESHOLD;
  const maxItemsPerAgent = input.maxItemsPerAgent ?? DEFAULT_USER_MEMORY_MAX_ITEMS_PER_AGENT;
  const excludedSourceProjectIds = [...new Set(input.excludedSourceProjectIds ?? [])];
  const excludedSet = new Set(excludedSourceProjectIds);
  const ignoredSet = new Set(input.ignoredMemoryItemIds ?? []);
  const pinnedSet = new Set(input.pinnedMemoryItemIds ?? []);
  const agents = input.agent ? [input.agent] : [...PROJECT_KNOWLEDGE_AGENTS];
  const byAgent = emptyByAgent();

  for (const source of input.sourceProjects) {
    if (source.ownerUserId !== input.userId) continue;
    if (input.targetProjectId && source.projectId === input.targetProjectId) continue;
    if (excludedSet.has(source.projectId)) continue;

    const projectTitle = source.projectTitle
      ? sanitizeAgentKnowledgeText(source.projectTitle)
      : undefined;

    for (const node of source.nodes) {
      for (const agent of agents) {
        if (!isAgentPromptRelevant(node, agent, minRelevance)) continue;

        const id = buildUserProjectKnowledgeMemoryItemId(source.projectId, node.id, agent);
        if (ignoredSet.has(id)) continue;

        const lifecycle: UserProjectKnowledgeMemoryLifecycle = pinnedSet.has(id)
          ? "PINNED"
          : "AUTO_CAPTURED";

        const item = createMemoryItem({
          sourceProjectId: source.projectId,
          sourceProjectTitle: projectTitle || undefined,
          sourceUpdatedAt: source.updatedAt,
          node,
          agent,
          lifecycle,
        });
        if (!item) continue;
        byAgent[agent].push(item);
      }
    }
  }

  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    byAgent[agent].sort(compareMemoryItems);
    if (byAgent[agent].length > maxItemsPerAgent) {
      byAgent[agent] = byAgent[agent].slice(0, maxItemsPerAgent);
    }
  }

  let totalItemCount = 0;
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    totalItemCount += byAgent[agent].length;
  }

  return {
    byAgent,
    excludedSourceProjectIds,
    totalItemCount,
  };
}
