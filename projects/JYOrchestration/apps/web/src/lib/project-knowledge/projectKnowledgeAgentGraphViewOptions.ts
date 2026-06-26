import type { ProjectKnowledgeGraphView } from "@/lib/project-knowledge/projectKnowledgeAgentGraphProjection";

export const AGENT_GRAPH_VIEW_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "planner", label: "기획자" },
  { value: "analyst", label: "분석가" },
  { value: "developer", label: "개발자" },
  { value: "reviewer", label: "검수자" },
  { value: "security", label: "보안관" },
] as const satisfies ReadonlyArray<{ readonly value: ProjectKnowledgeGraphView; readonly label: string }>;
