import {
  PROJECT_KNOWLEDGE_AGENTS,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import {
  collectUserProjectKnowledgeMemory,
  findUserProjectKnowledgeMemoryItemsByIds,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryCollector";
import {
  opaqueMemoryItemActionId,
  opaqueSourceProjectActionId,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryOpaqueActionId";
import { listSameUserProjectKnowledgeMemorySources } from "@/lib/project-knowledge/projectKnowledgeUserMemorySourceQuery";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import { normalizeUserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import { applyUserProjectKnowledgeMemoryControlToPrepareInput } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlService";
import type { UserProjectKnowledgeMemoryItem } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

export type UserMemoryActionKind = "memory_item" | "source_project";

export type ResolvedUserMemoryAction = Readonly<{
  readonly kind: UserMemoryActionKind;
  readonly rawId: string;
}>;

function enumerateMemoryItemsForResolver(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly control: UserProjectKnowledgeMemoryControlV1;
  readonly sourceProjects: Awaited<ReturnType<typeof listSameUserProjectKnowledgeMemorySources>>;
}): readonly UserProjectKnowledgeMemoryItem[] {
  const apply = applyUserProjectKnowledgeMemoryControlToPrepareInput({ control: input.control });
  if (apply.disabled) return [];

  const collected = collectUserProjectKnowledgeMemory({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    sourceProjects: input.sourceProjects,
    excludedSourceProjectIds: apply.excludedSourceProjectIds,
    ignoredMemoryItemIds: [],
    pinnedMemoryItemIds: apply.pinnedMemoryItemIds,
    maxItemsPerAgent: 999,
  });

  const ignored = findUserProjectKnowledgeMemoryItemsByIds({
    userId: input.userId,
    targetProjectId: input.targetProjectId,
    sourceProjects: input.sourceProjects,
    excludedSourceProjectIds: apply.excludedSourceProjectIds,
    ignoredMemoryItemIds: apply.ignoredMemoryItemIds,
    pinnedMemoryItemIds: apply.pinnedMemoryItemIds,
    itemIds: apply.ignoredMemoryItemIds,
  });

  const seen = new Set<string>();
  const out: UserProjectKnowledgeMemoryItem[] = [];
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    for (const item of collected.byAgent[agent]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  for (const item of ignored) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function enumerateSourceProjectIdsForResolver(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly sourceProjects: Awaited<ReturnType<typeof listSameUserProjectKnowledgeMemorySources>>;
}): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const source of input.sourceProjects) {
    if (source.ownerUserId !== input.userId) continue;
    if (source.projectId === input.targetProjectId) continue;
    if (seen.has(source.projectId)) continue;
    seen.add(source.projectId);
    ids.push(source.projectId);
  }
  return ids;
}

export async function resolveUserProjectKnowledgeMemoryActionId(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly actionId: string;
  readonly kind: UserMemoryActionKind;
  readonly control?: UserProjectKnowledgeMemoryControlV1 | null;
}): Promise<ResolvedUserMemoryAction | null> {
  const actionId = input.actionId.trim();
  if (!actionId) return null;

  const userId = input.userId.trim();
  const targetProjectId = input.targetProjectId.trim();
  if (!userId || !targetProjectId) return null;

  const control = normalizeUserProjectKnowledgeMemoryControlV1(input.control);
  const sourceProjects = await listSameUserProjectKnowledgeMemorySources({
    userId,
    targetProjectId,
  });

  if (input.kind === "memory_item") {
    const items = enumerateMemoryItemsForResolver({
      userId,
      targetProjectId,
      control,
      sourceProjects,
    });
    for (const item of items) {
      const opaque = opaqueMemoryItemActionId({
        userId,
        targetProjectId,
        rawItemId: item.id,
      });
      if (opaque === actionId) {
        return { kind: "memory_item", rawId: item.id };
      }
    }
    return null;
  }

  const sourceIds = enumerateSourceProjectIdsForResolver({
    userId,
    targetProjectId,
    sourceProjects,
  });
  for (const rawSourceProjectId of sourceIds) {
    const opaque = opaqueSourceProjectActionId({
      userId,
      targetProjectId,
      rawSourceProjectId,
    });
    if (opaque === actionId) {
      return { kind: "source_project", rawId: rawSourceProjectId };
    }
  }
  return null;
}

export function resolveUserProjectKnowledgeMemoryActionIdFromItems(input: {
  readonly userId: string;
  readonly targetProjectId: string;
  readonly actionId: string;
  readonly kind: UserMemoryActionKind;
  readonly memoryItems: readonly UserProjectKnowledgeMemoryItem[];
  readonly sourceProjectIds: readonly string[];
}): ResolvedUserMemoryAction | null {
  const actionId = input.actionId.trim();
  if (!actionId) return null;

  if (input.kind === "memory_item") {
    for (const item of input.memoryItems) {
      const opaque = opaqueMemoryItemActionId({
        userId: input.userId,
        targetProjectId: input.targetProjectId,
        rawItemId: item.id,
      });
      if (opaque === actionId) return { kind: "memory_item", rawId: item.id };
    }
    return null;
  }

  for (const rawSourceProjectId of input.sourceProjectIds) {
    const opaque = opaqueSourceProjectActionId({
      userId: input.userId,
      targetProjectId: input.targetProjectId,
      rawSourceProjectId,
    });
    if (opaque === actionId) return { kind: "source_project", rawId: rawSourceProjectId };
  }
  return null;
}
