import type { ProjectKnowledgeAgent } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import type { UserProjectKnowledgeMemoryTimelineSummary } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPromptInjection";

export const USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO: Readonly<
  Record<ProjectKnowledgeAgent, string>
> = {
  planner: "기획자",
  analyst: "분석가",
  developer: "개발자",
  reviewer: "검수자",
  security: "보안관",
};

export function formatUserProjectKnowledgeMemoryTimelineLine(
  row: UserProjectKnowledgeMemoryTimelineSummary,
): string {
  const label = USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO[row.agent] ?? row.agent;
  if (!row.injected || row.itemCount <= 0) {
    return `${label}: 참조 없음`;
  }
  return `${label}: ${row.itemCount}개 참조됨`;
}

export function formatUserProjectKnowledgeMemoryTimelineBlock(input: {
  readonly enabled?: boolean;
  readonly contexts?: readonly UserProjectKnowledgeMemoryTimelineSummary[];
}): string | null {
  if (input.enabled === false) {
    return "User Project Knowledge Memory · 자동 반영 꺼짐";
  }
  const rows = input.contexts ?? [];
  if (!rows.length) return null;
  const lines = rows.map((row) => formatUserProjectKnowledgeMemoryTimelineLine(row));
  return ["User Project Knowledge Memory", ...lines.map((l) => `- ${l}`)].join("\n");
}
