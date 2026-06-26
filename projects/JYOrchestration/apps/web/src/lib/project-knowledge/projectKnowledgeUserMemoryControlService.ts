import {
  PROJECT_KNOWLEDGE_AGENTS,
  type ProjectKnowledgeAgent,
} from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { buildUserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptContext";
import type { UserProjectKnowledgeMemoryControlV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import {
  isAgentMemoryEnabledInControl,
  normalizeUserProjectKnowledgeMemoryControlV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryControlTypes";
import type { UserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

function dedupeMergeIds(...groups: readonly (readonly string[] | undefined)[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const raw of group ?? []) {
      const id = String(raw ?? "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function applyUserProjectKnowledgeMemoryControlToPrepareInput(input: {
  readonly control: UserProjectKnowledgeMemoryControlV1;
  readonly base?: Readonly<{
    readonly excludedSourceProjectIds?: readonly string[];
    readonly ignoredMemoryItemIds?: readonly string[];
    readonly pinnedMemoryItemIds?: readonly string[];
  }>;
}): Readonly<{
  readonly disabled: boolean;
  readonly excludedSourceProjectIds: readonly string[];
  readonly ignoredMemoryItemIds: readonly string[];
  readonly pinnedMemoryItemIds: readonly string[];
}> {
  const control = normalizeUserProjectKnowledgeMemoryControlV1(input.control);
  if (!control.enabled) {
    return {
      disabled: true,
      excludedSourceProjectIds: [],
      ignoredMemoryItemIds: [],
      pinnedMemoryItemIds: [],
    };
  }
  return {
    disabled: false,
    excludedSourceProjectIds: dedupeMergeIds(
      control.excludedSourceProjectIds,
      input.base?.excludedSourceProjectIds,
    ),
    ignoredMemoryItemIds: dedupeMergeIds(control.ignoredMemoryItemIds, input.base?.ignoredMemoryItemIds),
    pinnedMemoryItemIds: dedupeMergeIds(control.pinnedMemoryItemIds, input.base?.pinnedMemoryItemIds),
  };
}

export function emptyUserProjectKnowledgeMemoryContextsByAgent(): Readonly<
  Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>
> {
  const byAgent = {} as Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>;
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    byAgent[agent] = buildUserProjectKnowledgeAgentPromptContext({ agent, items: [] });
  }
  return byAgent;
}

export function applyAgentEnabledToMemoryContexts(input: {
  readonly control: UserProjectKnowledgeMemoryControlV1;
  readonly byAgent: Readonly<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>>;
}): Readonly<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>> {
  const control = normalizeUserProjectKnowledgeMemoryControlV1(input.control);
  const out = { ...input.byAgent } as Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>;
  for (const agent of PROJECT_KNOWLEDGE_AGENTS) {
    if (!isAgentMemoryEnabledInControl(control, agent)) {
      out[agent] = buildUserProjectKnowledgeAgentPromptContext({ agent, items: [] });
    }
  }
  return out;
}
