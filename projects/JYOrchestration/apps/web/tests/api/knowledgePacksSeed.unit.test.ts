import { describe, expect, it } from "vitest";

import type { KnowledgePack } from "@/lib/knowledge-packs/types";
import {
  DEVELOPER_GRID_KNOWLEDGE_PACKS,
  DEVELOPER_SEED_KNOWLEDGE_PACKS,
  filterKnowledgePacks,
  getKnowledgePackById,
  KNOWLEDGE_PACK_AGENT_LABEL,
  KNOWLEDGE_PACK_CATEGORY_LABEL,
} from "@/lib/knowledge-packs/developerGridPacks";

const LEGACY_GRID_THREE_IDS = ["grid.ag-grid-community", "grid.tanstack-table", "grid.tabulator"] as const;
const ALL_EXPECTED_IDS = [
  "grid.ag-grid-community",
  "grid.tanstack-table",
  "grid.tabulator",
  "grid.toast-ui-grid",
  "auth.kakao-login",
] as const;

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

function assertPackCoreSections(p: KnowledgePack): void {
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

describe("knowledge pack seed / resolver (정적 seed 5종 + Grid 배열)", () => {
  it("1. DEVELOPER_SEED_KNOWLEDGE_PACKS는 5개이며 기대 id를 포함한다", () => {
    expect(DEVELOPER_SEED_KNOWLEDGE_PACKS.length).toBe(5);
    const ids = DEVELOPER_SEED_KNOWLEDGE_PACKS.map((p) => p.id);
    for (const id of ALL_EXPECTED_IDS) {
      expect(ids).toContain(id);
    }
  });

  it("2. 모든 지식팩 id는 중복되지 않는다", () => {
    const ids = DEVELOPER_SEED_KNOWLEDGE_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("3. grid.toast-ui-grid가 존재한다", () => {
    expect(DEVELOPER_SEED_KNOWLEDGE_PACKS.some((p) => p.id === "grid.toast-ui-grid")).toBe(true);
  });

  it("4. auth.kakao-login이 존재한다", () => {
    expect(DEVELOPER_SEED_KNOWLEDGE_PACKS.some((p) => p.id === "auth.kakao-login")).toBe(true);
  });

  it("5. grid.toast-ui-grid는 category GRID이다", () => {
    expect(getKnowledgePackById("grid.toast-ui-grid")?.category).toBe("GRID");
  });

  it("6. auth.kakao-login은 category AUTH이다", () => {
    expect(getKnowledgePackById("auth.kakao-login")?.category).toBe("AUTH");
  });

  it("7. 두 신규 지식팩 모두 AI_DEVELOPER agent를 포함한다", () => {
    expect(getKnowledgePackById("grid.toast-ui-grid")?.agents).toContain("AI_DEVELOPER");
    expect(getKnowledgePackById("auth.kakao-login")?.agents).toContain("AI_DEVELOPER");
  });

  it("8. 두 신규 지식팩 모두 ACTIVE 상태이다", () => {
    expect(getKnowledgePackById("grid.toast-ui-grid")?.status).toBe("ACTIVE");
    expect(getKnowledgePackById("auth.kakao-login")?.status).toBe("ACTIVE");
  });

  it("9. 두 신규 지식팩의 핵심 필드가 비어 있지 않다", () => {
    const toast = getKnowledgePackById("grid.toast-ui-grid");
    const kakao = getKnowledgePackById("auth.kakao-login");
    expect(toast).toBeDefined();
    expect(kakao).toBeDefined();
    assertPackCoreSections(toast!);
    assertPackCoreSections(kakao!);
  });

  it("10. getKnowledgePackById(grid.toast-ui-grid)가 정상 반환한다", () => {
    const p = getKnowledgePackById("grid.toast-ui-grid");
    expect(p?.name).toBe("NHN TOAST UI Grid");
  });

  it("11. getKnowledgePackById(auth.kakao-login)가 정상 반환한다", () => {
    const p = getKnowledgePackById("auth.kakao-login");
    expect(p?.name).toBe("Kakao Login");
  });

  it("12. filterKnowledgePacks({ agent: AI_DEVELOPER, category: GRID })는 Grid 4개", () => {
    expect(filterKnowledgePacks({ agent: "AI_DEVELOPER", category: "GRID" }).length).toBe(4);
  });

  it("13. filterKnowledgePacks({ agent: AI_DEVELOPER, category: AUTH })는 Kakao Login 1개", () => {
    const r = filterKnowledgePacks({ agent: "AI_DEVELOPER", category: "AUTH" });
    expect(r.length).toBe(1);
    expect(r[0]?.id).toBe("auth.kakao-login");
  });

  it("14. filterKnowledgePacks({ agent: AI_DEVELOPER, category: ALL })는 5개", () => {
    expect(filterKnowledgePacks({ agent: "AI_DEVELOPER", category: "ALL" }).length).toBe(5);
  });

  it("15. DEVELOPER_GRID_KNOWLEDGE_PACKS는 Grid 4개(기존 3 + TOAST)이며 모두 GRID", () => {
    expect(DEVELOPER_GRID_KNOWLEDGE_PACKS.length).toBe(4);
    for (const p of DEVELOPER_GRID_KNOWLEDGE_PACKS) {
      expect(p.category).toBe("GRID");
      expect(p.agents).toContain("AI_DEVELOPER");
    }
    const gids = DEVELOPER_GRID_KNOWLEDGE_PACKS.map((p) => p.id);
    for (const id of [...LEGACY_GRID_THREE_IDS, "grid.toast-ui-grid"]) {
      expect(gids).toContain(id);
    }
  });

  it("16. 기존 Grid 3종 id·이름·핵심 문구 유지", () => {
    expect(getKnowledgePackById("grid.ag-grid-community")?.name).toBe("AG Grid Community");
    expect(getKnowledgePackById("grid.tanstack-table")?.name).toBe("TanStack Table");
    expect(getKnowledgePackById("grid.tabulator")?.name).toBe("Tabulator");
    for (const id of LEGACY_GRID_THREE_IDS) {
      const p = getKnowledgePackById(id);
      expect(p).toBeDefined();
      assertPackCoreSections(p!);
    }
  });

  it("17. getKnowledgePackById trim 및 미존재", () => {
    expect(getKnowledgePackById("unknown.pack")).toBeUndefined();
    expect(getKnowledgePackById("")).toBeUndefined();
    for (const p of DEVELOPER_SEED_KNOWLEDGE_PACKS) {
      expect(getKnowledgePackById(p.id)).toBe(p);
      expect(getKnowledgePackById(`  ${p.id}  `)).toBe(p);
    }
  });

  it("18. filterKnowledgePacks 기타 조합", () => {
    expect(filterKnowledgePacks({ agent: "AI_PLANNER", category: "GRID" }).length).toBe(0);
    expect(filterKnowledgePacks({ agent: "ALL", category: "GRID" }).length).toBe(4);
    expect(filterKnowledgePacks({ agent: "ALL", category: "AUTH" }).length).toBe(1);
  });

  it("19. KNOWLEDGE_PACK_AGENT_LABEL / KNOWLEDGE_PACK_CATEGORY_LABEL", () => {
    expect(KNOWLEDGE_PACK_AGENT_LABEL.AI_DEVELOPER).toBe("AI개발자");
    expect(KNOWLEDGE_PACK_CATEGORY_LABEL.GRID).toBe("Grid");
    expect(KNOWLEDGE_PACK_CATEGORY_LABEL.AUTH).toBe("인증");
  });

  it("20. 정적 seed는 PLATFORM scope 유지", () => {
    for (const p of DEVELOPER_SEED_KNOWLEDGE_PACKS) {
      expect(p.scope).toBe("PLATFORM");
    }
  });
});
