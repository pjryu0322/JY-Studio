import type { ProjectKnowledgeAgent } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import type { UserProjectKnowledgeAgentPromptContext } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";
import { userProjectKnowledgeAgentSectionTitle } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptContext";

export const USER_PROJECT_KNOWLEDGE_MEMORY_SECTION_HEADING = "## Same-user Project Knowledge Memory";

export type UserProjectKnowledgeMemoryTimelineSummary = Readonly<{
  readonly kind: "user_project_knowledge_memory_context";
  readonly agent: ProjectKnowledgeAgent;
  readonly itemCount: number;
  readonly sourceProjectCount: number;
  readonly injected: boolean;
}>;

export function appendUserProjectKnowledgeMemorySection(input: {
  readonly basePrompt: string;
  readonly context: UserProjectKnowledgeAgentPromptContext | null | undefined;
  readonly includeEmptyContext?: boolean;
}): string {
  const base = input.basePrompt.trimEnd();
  const context = input.context;
  if (!context) return base;

  const sectionTitle = context.sectionTitle.trim();
  if (sectionTitle && base.includes(sectionTitle)) {
    return base;
  }

  if (context.itemCount === 0 && input.includeEmptyContext !== true) {
    return base;
  }

  const markdown = context.markdown.trim();
  if (!markdown) return base;

  const memoryBlock = [USER_PROJECT_KNOWLEDGE_MEMORY_SECTION_HEADING, markdown].join("\n");
  if (!base) return memoryBlock;
  return `${base}\n\n${memoryBlock}`;
}

export function composeProjectTurnContextBlocks(input: {
  readonly referencePromptContextBlock?: string;
  readonly userMemoryContext?: UserProjectKnowledgeAgentPromptContext | null;
  readonly includeEmptyUserMemory?: boolean;
}): string {
  const reference = String(input.referencePromptContextBlock ?? "").trim().slice(0, 6000);
  const memoryAppend = appendUserProjectKnowledgeMemorySection({
    basePrompt: "",
    context: input.userMemoryContext,
    includeEmptyContext: input.includeEmptyUserMemory,
  }).trim();
  return [reference, memoryAppend].filter(Boolean).join("\n\n");
}

export function buildUserProjectKnowledgeMemoryTimelineSummaries(
  byAgent: Readonly<Partial<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>>>,
): readonly UserProjectKnowledgeMemoryTimelineSummary[] {
  const agents = Object.keys(byAgent) as ProjectKnowledgeAgent[];
  return agents.map((agent) => {
    const ctx = byAgent[agent];
    const itemCount = ctx?.itemCount ?? 0;
    return {
      kind: "user_project_knowledge_memory_context" as const,
      agent,
      itemCount,
      sourceProjectCount: ctx?.sourceProjectCount ?? 0,
      injected: itemCount > 0,
    };
  });
}

export function specialistGroupProjectKnowledgeAgent(
  groupLabel: "flow-analyst" | "feature-designer" | "security-reviewer",
): ProjectKnowledgeAgent {
  if (groupLabel === "flow-analyst") return "analyst";
  if (groupLabel === "feature-designer") return "developer";
  return "security";
}

export function orchestrationPromptContextForAgent(input: {
  readonly referencePromptContextBlock: string;
  readonly userProjectKnowledgeMemoryByAgent?: Readonly<
    Partial<Record<ProjectKnowledgeAgent, UserProjectKnowledgeAgentPromptContext>>
  >;
  readonly agent: ProjectKnowledgeAgent;
}): string {
  return composeProjectTurnContextBlocks({
    referencePromptContextBlock: input.referencePromptContextBlock,
    userMemoryContext: input.userProjectKnowledgeMemoryByAgent?.[input.agent],
  });
}

/** @deprecated Prefer sectionTitle on context — used for duplicate-section guard. */
export function agentMemorySectionMarker(agent: ProjectKnowledgeAgent): string {
  return userProjectKnowledgeAgentSectionTitle(agent);
}
