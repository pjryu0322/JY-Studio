import {
  PROJECT_KNOWLEDGE_AGENTS,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import {
  collectUserProjectKnowledgeMemory,
  findUserProjectKnowledgeMemoryItemsByIds,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryCollector";
import {
  applyUserProjectKnowledgeMemoryControlToPrepareInput,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlService";
import { listSameUserProjectKnowledgeMemorySources } from "@/lib/project-knowledge/projectKnowledgeUserMemorySourceQuery";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import {
  isAgentMemoryEnabledInControl,
  normalizeUserProjectKnowledgeMemoryControlV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type {
  UserProjectKnowledgeMemoryItem,
  UserProjectKnowledgeMemorySourceProject,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";
import {
  opaqueMemoryItemActionId,
  opaqueSourceProjectActionId,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryOpaqueActionId";

export type UserProjectKnowledgeMemoryPreviewItemV1 = Readonly<{
  readonly actionId: string;
  readonly sourceProjectActionId?: string;
  readonly sourceProjectTitle?: string;
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
  readonly ignoredItems?: readonly UserProjectKnowledgeMemoryPreviewItemV1[];
}>;

export type UserProjectKnowledgeMemoryPreviewV1 = Readonly<{
  readonly enabled: boolean;
  readonly sourceProjectCount: number;
  readonly totalItemCount: number;
  readonly byAgent: Readonly<Record<ProjectKnowledgeAgent, UserProjectKnowledgeMemoryPreviewByAgentV1>>;
}>;

function safeSourceProjectTitle(item: UserProjectKnowledgeMemoryItem): string {
  const title = item.sourceProjectTitle?.trim();
  const pid = item.sourceProjectId.trim();
  if (!title) return "이전 프로젝트";
  if (pid && (title === pid || title.includes(pid))) return "이전 프로젝트";
  return title;
}

function mapPreviewItem(input: {
  readonly item: UserProjectKnowledgeMemoryItem;
  readonly control: UserProjectKnowledgeMemoryControlV1;
  readonly userId: string;
  readonly targetProjectId: string;
  readonly forceIgnored?: boolean;
}): UserProjectKnowledgeMemoryPreviewItemV1 {
  const pinned =
    input.control.pinnedMemoryItemIds.includes(input.item.id) || input.item.lifecycle === "PINNED";
  const ignored =
    input.forceIgnored ||
    input.control.ignoredMemoryItemIds.includes(input.item.id) ||
    input.item.lifecycle === "IGNORED";

  return {
    actionId: opaqueMemoryItemActionId({
      userId: input.userId,
      targetProjectId: input.targetProjectId,
      rawItemId: input.item.id,
    }),
    sourceProjectTitle: safeSourceProjectTitle(input.item),
    sourceProjectActionId: opaqueSourceProjectActionId({
      userId: input.userId,
      targetProjectId: input.targetProjectId,
      rawSourceProjectId: input.item.sourceProjectId,
    }),
    nodeType: input.item.nodeType,
    title: input.item.title,
    promptSummary: input.item.promptSummary,
    useAs: input.item.useAs,
    relevance: input.item.relevance,
    lifecycle: input.item.lifecycle,
    pinned,
    ignored,
    agent: input.item.agent,
  };
}

export function buildUserProjectKnowledgeMemoryPreviewFromSources(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly sourceProjects: readonly UserProjectKnowledgeMemorySourceProject[];
  readonly control?: UserProjectKnowledgeMemoryControlV1 | null;
}): UserProjectKnowledgeMemoryPreviewV1 {
  const control = normalizeUserProjectKnowledgeMemoryControlV1(input.control);
  const apply = applyUserProjectKnowledgeMemoryControlToPrepareInput({ control });

  const emptyByAgent = (): Record<ProjectKnowledgeAgent, UserProjectKnowledgeMemoryPreviewByAgentV1> => {
    const byAgent = {} as Record<ProjectKnowledgeAgent, UserProjectKnowledgeMemoryPreviewByAgentV1>;
    for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
      byAgent[agent] = { enabled: false, itemCount: 0, items: [], ignoredItems: [] };
    }
    return byAgent;
  };

  if (apply.disabled) {
    return {
      enabled: false,
      sourceProjectCount: 0,
      totalItemCount: 0,
      byAgent: emptyByAgent(),
    };
  }

  const userId = input.userId.trim();
  const targetProjectId = input.targetProjectId.trim();

  const collected = collectUserProjectKnowledgeMemory({
    userId,
    targetProjectId,
    sourceProjects: input.sourceProjects,
    excludedSourceProjectIds: apply.excludedSourceProjectIds,
    ignoredMemoryItemIds: apply.ignoredMemoryItemIds,
    pinnedMemoryItemIds: apply.pinnedMemoryItemIds,
  });

  const ignoredRawItems = findUserProjectKnowledgeMemoryItemsByIds({
    userId,
    targetProjectId,
    sourceProjects: input.sourceProjects,
    excludedSourceProjectIds: apply.excludedSourceProjectIds,
    ignoredMemoryItemIds: apply.ignoredMemoryItemIds,
    pinnedMemoryItemIds: apply.pinnedMemoryItemIds,
    itemIds: apply.ignoredMemoryItemIds,
  });

  const byAgent = {} as Record<ProjectKnowledgeAgent, UserProjectKnowledgeMemoryPreviewByAgentV1>;
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    const agentEnabled = isAgentMemoryEnabledInControl(control, agent);
    const items = agentEnabled
      ? collected.byAgent[agent].map((item) =>
          mapPreviewItem({ item, control, userId, targetProjectId }),
        )
      : [];
    const ignoredItems = ignoredRawItems
      .filter((item) => item.agent === agent)
      .map((item) =>
        mapPreviewItem({ item, control, userId, targetProjectId, forceIgnored: true }),
      );

    byAgent[agent] = {
      enabled: agentEnabled,
      itemCount: agentEnabled ? items.length : 0,
      items,
      ...(ignoredItems.length ? { ignoredItems } : {}),
    };
  }

  const totalItemCount = PROJECT_KNOWLEDGE_AGENTS.reduce(
    (sum, agent) => sum + byAgent[agent].itemCount,
    0,
  );

  const activeItems = PROJECT_KNOWLEDGE_AGENTS.flatMap((agent) => byAgent[agent].items);
  const sourceProjectCount = new Set(
    activeItems.map((item) => item.sourceProjectActionId).filter(Boolean),
  ).size;

  return {
    enabled: true,
    sourceProjectCount,
    totalItemCount,
    byAgent,
  };
}

export async function buildUserProjectKnowledgeMemoryPreview(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly control?: UserProjectKnowledgeMemoryControlV1 | null;
  readonly limitProjects?: number;
}): Promise<UserProjectKnowledgeMemoryPreviewV1> {
  const sourceProjects = await listSameUserProjectKnowledgeMemorySources({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    limitProjects: input.limitProjects,
  });

  return buildUserProjectKnowledgeMemoryPreviewFromSources({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    sourceProjects,
    control: input.control,
  });
}
