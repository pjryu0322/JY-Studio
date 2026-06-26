import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import { patchUserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import { resolveUserProjectKnowledgeMemoryActionId } from "@/lib/project-knowledge/projectKnowledgeUserMemoryActionResolver";
import {
  loadUserProjectKnowledgeMemoryControlForProject,
  saveUserProjectKnowledgeMemoryControlForProject,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlProjectPersistence";

export type UserMemoryControlAction =
  | { readonly type: "SET_ENABLED"; readonly enabled: boolean }
  | { readonly type: "SET_AGENT_ENABLED"; readonly agent: string; readonly enabled: boolean }
  | { readonly type: "PIN_MEMORY_ITEM"; readonly actionId: string }
  | { readonly type: "UNPIN_MEMORY_ITEM"; readonly actionId: string }
  | { readonly type: "IGNORE_MEMORY_ITEM"; readonly actionId: string }
  | { readonly type: "UNIGNORE_MEMORY_ITEM"; readonly actionId: string }
  | { readonly type: "EXCLUDE_SOURCE_PROJECT"; readonly actionId: string };

function dedupeIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export class UserMemoryControlActionNotFoundError extends Error {
  constructor() {
    super("알 수 없는 memory action입니다.");
    this.name = "UserMemoryControlActionNotFoundError";
  }
}

export async function applyUserMemoryControlActionToPatch(input: {
  readonly userId: string;
  readonly projectId: string;
  readonly action: UserMemoryControlAction;
  readonly currentControl: UserProjectKnowledgeMemoryControlV1;
}): Promise<Partial<UserProjectKnowledgeMemoryControlV1>> {
  const action = input.action;
  const base = input.currentControl;

  if (action.type === "SET_ENABLED") {
    return { enabled: action.enabled };
  }

  if (action.type === "SET_AGENT_ENABLED") {
    const agent = String(action.agent ?? "").trim();
    if (!agent) return {};
    return {
      agentEnabled: {
        ...base.agentEnabled,
        [agent]: action.enabled,
      },
    };
  }

  const resolveMemory = async (actionId: string) =>
    resolveUserProjectKnowledgeMemoryActionId({
      userId: input.userId,
      targetProjectId: input.projectId,
      actionId,
      kind: "memory_item",
      control: base,
    });

  const resolveSource = async (actionId: string) =>
    resolveUserProjectKnowledgeMemoryActionId({
      userId: input.userId,
      targetProjectId: input.projectId,
      actionId,
      kind: "source_project",
      control: base,
    });

  switch (action.type) {
    case "PIN_MEMORY_ITEM": {
      const resolved = await resolveMemory(action.actionId);
      if (!resolved) throw new UserMemoryControlActionNotFoundError();
      const pinned = new Set(base.pinnedMemoryItemIds);
      const ignored = new Set(base.ignoredMemoryItemIds);
      pinned.add(resolved.rawId);
      ignored.delete(resolved.rawId);
      return {
        pinnedMemoryItemIds: dedupeIds([...pinned]),
        ignoredMemoryItemIds: dedupeIds([...ignored]),
      };
    }
    case "UNPIN_MEMORY_ITEM": {
      const resolved = await resolveMemory(action.actionId);
      if (!resolved) throw new UserMemoryControlActionNotFoundError();
      const pinned = new Set(base.pinnedMemoryItemIds);
      pinned.delete(resolved.rawId);
      return { pinnedMemoryItemIds: dedupeIds([...pinned]) };
    }
    case "IGNORE_MEMORY_ITEM": {
      const resolved = await resolveMemory(action.actionId);
      if (!resolved) throw new UserMemoryControlActionNotFoundError();
      const pinned = new Set(base.pinnedMemoryItemIds);
      const ignored = new Set(base.ignoredMemoryItemIds);
      ignored.add(resolved.rawId);
      pinned.delete(resolved.rawId);
      return {
        pinnedMemoryItemIds: dedupeIds([...pinned]),
        ignoredMemoryItemIds: dedupeIds([...ignored]),
      };
    }
    case "UNIGNORE_MEMORY_ITEM": {
      const resolved = await resolveMemory(action.actionId);
      if (!resolved) throw new UserMemoryControlActionNotFoundError();
      const ignored = new Set(base.ignoredMemoryItemIds);
      ignored.delete(resolved.rawId);
      return { ignoredMemoryItemIds: dedupeIds([...ignored]) };
    }
    case "EXCLUDE_SOURCE_PROJECT": {
      const resolved = await resolveSource(action.actionId);
      if (!resolved) throw new UserMemoryControlActionNotFoundError();
      const excluded = new Set(base.excludedSourceProjectIds);
      excluded.add(resolved.rawId);
      return { excludedSourceProjectIds: dedupeIds([...excluded]) };
    }
    default:
      return {};
  }
}

export async function patchUserProjectKnowledgeMemoryControlWithAction(input: {
  readonly userId: string;
  readonly projectId: string;
  readonly action: UserMemoryControlAction;
}): Promise<UserProjectKnowledgeMemoryControlV1> {
  const current = await loadUserProjectKnowledgeMemoryControlForProject(input.projectId);
  const patch = await applyUserMemoryControlActionToPatch({
    userId: input.userId,
    projectId: input.projectId,
    action: input.action,
    currentControl: current,
  });
  const next = patchUserProjectKnowledgeMemoryControlV1(current, patch);
  return saveUserProjectKnowledgeMemoryControlForProject({
    projectId: input.projectId,
    control: next,
  });
}
