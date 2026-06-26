import {
  PROJECT_KNOWLEDGE_AGENTS,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { collectUserProjectKnowledgeMemory } from "@/lib/project-knowledge/projectKnowledgeUserMemoryCollector";
import {
  applyUserProjectKnowledgeMemoryControlToPrepareInput,
  applyAgentEnabledToMemoryContexts,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlService";
import { prepareUserProjectKnowledgeMemoryContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryService";
import { listSameUserProjectKnowledgeMemorySources } from "@/lib/project-knowledge/projectKnowledgeUserMemorySourceQuery";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import {
  isAgentMemoryEnabledInControl,
  normalizeUserProjectKnowledgeMemoryControlV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeMemoryItem } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

export type UserProjectKnowledgeMemoryPreviewItemV1 = Readonly<{
  readonly displayId: string;
  readonly sourceProjectTitle?: string;
  /** PATCH exclude action only — do not render in UI labels */
  readonly sourceProjectActionId?: string;
  readonly nodeType: string;
  readonly title: string;
  readonly promptSummary: string;
  readonly useAs: string;
  readonly relevance: number;
  readonly lifecycle: UserProjectKnowledgeMemoryItem["lifecycle"];
  readonly pinned: boolean;
  readonly ignored: boolean;
  readonly agent: ProjectKnowledgeAgent;
}>;

export type UserProjectKnowledgeMemoryPreviewByAgentV1 = Readonly<{
  readonly enabled: boolean;
  readonly itemCount: number;
  readonly items: readonly UserProjectKnowledgeMemoryPreviewItemV1[];
}>;

export type UserProjectKnowledgeMemoryPreviewV1 = Readonly<{
  readonly enabled: boolean;
  readonly sourceProjectCount: number;
  readonly totalItemCount: number;
  readonly byAgent: Readonly<Record<ProjectKnowledgeAgent, UserProjectKnowledgeMemoryPreviewByAgentV1>>;
}>;

function mapPreviewItem(
  item: UserProjectKnowledgeMemoryItem,
  control: UserProjectKnowledgeMemoryControlV1,
): UserProjectKnowledgeMemoryPreviewItemV1 {
  const pinned = control.pinnedMemoryItemIds.includes(item.id) || item.lifecycle === "PINNED";
  const ignored = control.ignoredMemoryItemIds.includes(item.id) || item.lifecycle === "IGNORED";
  return {
    displayId: item.id,
    sourceProjectTitle: item.sourceProjectTitle?.trim() || "이전 프로젝트",
    sourceProjectActionId: item.sourceProjectId,
    nodeType: item.nodeType,
    title: item.title,
    promptSummary: item.promptSummary,
    useAs: item.useAs,
    relevance: item.relevance,
    lifecycle: item.lifecycle,
    pinned,
    ignored,
    agent: item.agent,
  };
}

export async function buildUserProjectKnowledgeMemoryPreview(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly control?: UserProjectKnowledgeMemoryControlV1 | null;
  readonly limitProjects?: number;
}): Promise<UserProjectKnowledgeMemoryPreviewV1> {
  const control = normalizeUserProjectKnowledgeMemoryControlV1(input.control);
  const apply = applyUserProjectKnowledgeMemoryControlToPrepareInput({ control });

  if (apply.disabled) {
    const byAgent = {} as Record<ProjectKnowledgeAgent, UserProjectKnowledgeMemoryPreviewByAgentV1>;
    for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
      byAgent[agent] = { enabled: false, itemCount: 0, items: [] };
    }
    return {
      enabled: false,
      sourceProjectCount: 0,
      totalItemCount: 0,
      byAgent,
    };
  }

  const sourceProjects = await listSameUserProjectKnowledgeMemorySources({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    limitProjects: input.limitProjects,
  });

  const collected = collectUserProjectKnowledgeMemory({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    sourceProjects,
    excludedSourceProjectIds: apply.excludedSourceProjectIds,
    ignoredMemoryItemIds: apply.ignoredMemoryItemIds,
    pinnedMemoryItemIds: apply.pinnedMemoryItemIds,
  });

  const prepared = await prepareUserProjectKnowledgeMemoryContext({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    sourceProjects,
    excludedSourceProjectIds: apply.excludedSourceProjectIds,
    ignoredMemoryItemIds: apply.ignoredMemoryItemIds,
    pinnedMemoryItemIds: apply.pinnedMemoryItemIds,
  });
  const contexts = applyAgentEnabledToMemoryContexts({ control, byAgent: prepared.byAgent });

  const byAgent = {} as Record<ProjectKnowledgeAgent, UserProjectKnowledgeMemoryPreviewByAgentV1>;
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    const agentEnabled = isAgentMemoryEnabledInControl(control, agent);
    const items = collected.byAgent[agent].map((item) => mapPreviewItem(item, control));
    byAgent[agent] = {
      enabled: agentEnabled,
      itemCount: agentEnabled ? (contexts[agent]?.itemCount ?? 0) : 0,
      items: agentEnabled ? items : [],
    };
  }

  return {
    enabled: true,
    sourceProjectCount: sourceProjects.length,
    totalItemCount: prepared.totalItemCount,
    byAgent,
  };
}
