import { describe, expect, it } from "vitest";

import type { KnowledgePack } from "@/lib/knowledge-packs/types";
import {
  DEVELOPER_GRID_KNOWLEDGE_PACKS,
  filterKnowledgePacks,
  getKnowledgePackById,
  KNOWLEDGE_PACK_AGENT_LABEL,
  KNOWLEDGE_PACK_CATEGORY_LABEL,
} from "@/lib/knowledge-packs/developerGridPacks";

const REQUIRED_IDS = ["grid.ag-grid-community", "grid.tanstack-table", "grid.tabulator"] as const;

function assertNonEmptyStringField(pack: KnowledgePack, key: keyof Pick<KnowledgePack, "summary">): void {
  const v = pack[key];
  expect(typeof v).toBe("string");
  expect((v as string).trim().length).toBeGreaterThan(0);
}

function assertNonEmptyStringArray(
  pack: KnowledgePack,
  key: keyof Pick<
    KnowledgePack,
    | "recommendedUseCases"
    | "notRecommendedUseCases"
    | "capabilities"
    | "constraints"
    | "implementationGuidelines"
    | "cursorPromptRules"
    | "forbiddenPatterns"
    | "reviewChecklist"
    | "alternatives"
  >
): void {
  const arr = pack[key];
  expect(Array.isArray(arr)).toBe(true);
  expect(arr.length).toBeGreaterThan(0);
  for (const line of arr) {
    expect(typeof line).toBe("string");
    expect(line.trim().length).toBeGreaterThan(0);
  }
}

describe("knowledge pack seed / resolver (developer grid MVP)", () => {
  it("1. DEVELOPER_GRID_KNOWLEDGE_PACKS는 3개이며 기대 id를 포함한다", () => {
    expect(DEVELOPER_GRID_KNOWLEDGE_PACKS.length).toBe(3);
    const ids = DEVELOPER_GRID_KNOWLEDGE_PACKS.map((p) => p.id);
    for (const id of REQUIRED_IDS) {
      expect(ids).toContain(id);
    }
  });

  it("2. 모든 지식팩 id는 중복되지 않는다", () => {
    const ids = DEVELOPER_GRID_KNOWLEDGE_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("3. 필수 id 각각이 seed에 존재한다", () => {
    for (const id of REQUIRED_IDS) {
      expect(DEVELOPER_GRID_KNOWLEDGE_PACKS.some((p) => p.id === id)).toBe(true);
    }
  });

  it("4. 모든 지식팩은 AI_DEVELOPER agent를 포함한다", () => {
    for (const p of DEVELOPER_GRID_KNOWLEDGE_PACKS) {
      expect(p.agents).toContain("AI_DEVELOPER");
    }
  });

  it("5. 모든 지식팩은 GRID category이다", () => {
    for (const p of DEVELOPER_GRID_KNOWLEDGE_PACKS) {
      expect(p.category).toBe("GRID");
    }
  });

  it("6. 모든 지식팩은 ACTIVE 상태이다", () => {
    for (const p of DEVELOPER_GRID_KNOWLEDGE_PACKS) {
      expect(p.status).toBe("ACTIVE");
    }
  });

  it("7. 필수 섹션이 비어 있지 않다 (핵심 4개 포함)", () => {
    for (const p of DEVELOPER_GRID_KNOWLEDGE_PACKS) {
      assertNonEmptyStringField(p, "summary");
      assertNonEmptyStringArray(p, "recommendedUseCases");
      assertNonEmptyStringArray(p, "notRecommendedUseCases");
      assertNonEmptyStringArray(p, "capabilities");
      assertNonEmptyStringArray(p, "constraints");
      assertNonEmptyStringArray(p, "implementationGuidelines");
      assertNonEmptyStringArray(p, "cursorPromptRules");
      assertNonEmptyStringArray(p, "forbiddenPatterns");
      assertNonEmptyStringArray(p, "reviewChecklist");
      assertNonEmptyStringArray(p, "alternatives");
      expect(p.references.length).toBeGreaterThan(0);
      for (const r of p.references) {
        expect(r.label.trim().length).toBeGreaterThan(0);
        expect(r.url.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("8. getKnowledgePackById가 각 pack과 미존재를 올바르게 처리한다", () => {
    const ag = getKnowledgePackById("grid.ag-grid-community");
    expect(ag?.name).toBe("AG Grid Community");

    const tan = getKnowledgePackById("grid.tanstack-table");
    expect(tan?.name).toBe("TanStack Table");

    const tab = getKnowledgePackById("grid.tabulator");
    expect(tab?.name).toBe("Tabulator");

    expect(getKnowledgePackById("unknown.pack")).toBeUndefined();
    expect(getKnowledgePackById("")).toBeUndefined();

    for (const p of DEVELOPER_GRID_KNOWLEDGE_PACKS) {
      expect(getKnowledgePackById(p.id)).toBe(p);
      expect(getKnowledgePackById(`  ${p.id}  `)).toBe(p);
    }
  });

  it("9. filterKnowledgePacks 조합", () => {
    expect(filterKnowledgePacks({ agent: "AI_DEVELOPER", category: "GRID" }).length).toBe(3);
    expect(filterKnowledgePacks({ agent: "AI_PLANNER", category: "GRID" }).length).toBe(0);
    expect(filterKnowledgePacks({ agent: "ALL", category: "GRID" }).length).toBe(3);
    expect(filterKnowledgePacks({ agent: "AI_DEVELOPER", category: "AUTH" }).length).toBe(0);
    expect(filterKnowledgePacks({ agent: "AI_DEVELOPER", category: "ALL" }).length).toBe(3);
  });

  it("10. KNOWLEDGE_PACK_AGENT_LABEL / KNOWLEDGE_PACK_CATEGORY_LABEL", () => {
    expect(KNOWLEDGE_PACK_AGENT_LABEL.AI_DEVELOPER).toBe("AI개발자");
    expect(KNOWLEDGE_PACK_CATEGORY_LABEL.GRID).toBe("Grid");
  });

  it("MVP seed는 PLATFORM scope를 유지한다", () => {
    for (const p of DEVELOPER_GRID_KNOWLEDGE_PACKS) {
      expect(p.scope).toBe("PLATFORM");
    }
  });
});
