import { DEVELOPER_AUTH_KNOWLEDGE_PACKS } from "@/lib/knowledge-packs/developerAuthPacks";
import { DEVELOPER_GRID_KNOWLEDGE_PACKS } from "@/lib/knowledge-packs/developerGridPacks";
import type { KnowledgePack, KnowledgePackAgent } from "@/lib/knowledge-packs/types";

/** 목록·병합·정적 ID 판별 — Grid + Auth 전체 seed */
export const DEVELOPER_SEED_KNOWLEDGE_PACKS: readonly KnowledgePack[] = [
  ...DEVELOPER_GRID_KNOWLEDGE_PACKS,
  ...DEVELOPER_AUTH_KNOWLEDGE_PACKS,
];

export function getKnowledgePackById(id: string): KnowledgePack | undefined {
  const q = id.trim();
  return DEVELOPER_SEED_KNOWLEDGE_PACKS.find((p) => p.id === q);
}

export function filterKnowledgePacks(input: {
  readonly agent: KnowledgePack["agents"][number] | "ALL";
  readonly category: KnowledgePack["category"] | "ALL";
}): readonly KnowledgePack[] {
  return DEVELOPER_SEED_KNOWLEDGE_PACKS.filter((p) => {
    if (input.agent !== "ALL" && !p.agents.includes(input.agent)) return false;
    if (input.category !== "ALL" && p.category !== input.category) return false;
    return true;
  });
}

export const KNOWLEDGE_PACK_AGENT_LABEL: Record<KnowledgePackAgent, string> = {
  AI_DEVELOPER: "AI개발자",
  AI_PLANNER: "AI기획자",
  AI_ANALYST: "AI분석가",
  AI_ARCHITECT: "AI설계자",
  AI_DESIGNER: "AI디자이너",
  AI_REVIEWER: "AI검수자",
  AI_SECURITY: "AI보안관",
};

export const KNOWLEDGE_PACK_CATEGORY_LABEL: Record<KnowledgePack["category"], string> = {
  GRID: "Grid",
  AUTH: "인증",
  SECURITY: "보안",
  UI: "UI",
  API: "API",
  DATA: "데이터",
  INTEGRATION: "연동",
};
