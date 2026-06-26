import type { ProjectKnowledgeAgent } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import type {
  UserProjectKnowledgeAgentPromptContext,
  UserProjectKnowledgeMemoryItem,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryTypes";

const AGENT_SECTION_TITLES: Record<ProjectKnowledgeAgent, string> = {
  planner: "[User Project Knowledge for Planner]",
  analyst: "[User Project Knowledge for Analyst]",
  developer: "[User Project Knowledge for Developer]",
  reviewer: "[User Project Knowledge for Reviewer]",
  security: "[User Project Knowledge for Security]",
};

const AGENT_GUIDANCE: Record<ProjectKnowledgeAgent, string> = {
  planner:
    "Use it as reference for problem framing, MVP scope, and discovery questions.",
  analyst:
    "Use it as reference for actors, permissions, flows, and exception paths.",
  developer:
    "Use it as reference for screens, components, data models, and implementation hints.",
  reviewer:
    "Use it as reference for checklists, missing risks, and inconsistencies.",
  security:
    "Use it as reference for privacy, auth, permissions, storage, and integration risks.",
};

export function userProjectKnowledgeAgentSectionTitle(agent: ProjectKnowledgeAgent): string {
  return AGENT_SECTION_TITLES[agent];
}

export function buildUserProjectKnowledgeAgentPromptContext(input: {
  readonly agent: ProjectKnowledgeAgent;
  readonly items: readonly UserProjectKnowledgeMemoryItem[];
  readonly maxItems?: number;
}): UserProjectKnowledgeAgentPromptContext {
  const sectionTitle = userProjectKnowledgeAgentSectionTitle(input.agent);
  const maxItems = input.maxItems ?? input.items.length;
  const agentItems = input.items
    .filter((item) => item.agent === input.agent)
    .slice(0, maxItems);

  const sourceProjectIds = new Set(agentItems.map((item) => item.sourceProjectId));

  if (agentItems.length === 0) {
    return {
      agent: input.agent,
      sectionTitle,
      markdown: `${sectionTitle}\n\nNo same-user prior project knowledge is available for this agent.`,
      itemCount: 0,
      sourceProjectCount: 0,
    };
  }

  const intro = [
    sectionTitle,
    "",
    "The following same-user prior project knowledge may help this agent.",
    "Use it as reference context only. Do not copy project-specific identifiers or assume the target project has identical requirements.",
    AGENT_GUIDANCE[input.agent],
    "",
  ].join("\n");

  const lines = agentItems.map((item, index) => {
    const body = item.promptSummary;
    return [
      `${index + 1}. ${body}`,
      `   - useAs: ${item.useAs}`,
      `   - relevance: ${item.relevance.toFixed(2)}`,
      "   - source: prior project summary",
    ].join("\n");
  });

  return {
    agent: input.agent,
    sectionTitle,
    markdown: `${intro}${lines.join("\n\n")}`,
    itemCount: agentItems.length,
    sourceProjectCount: sourceProjectIds.size,
  };
}
