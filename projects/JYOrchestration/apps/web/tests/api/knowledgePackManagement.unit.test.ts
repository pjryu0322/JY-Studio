import { describe, expect, it } from "vitest";

import {
  dbRowToKnowledgePack,
  isStaticKnowledgePackId,
  knowledgePackFieldsToSections,
  mergeStaticAndDbKnowledgePacks,
  parseLines,
  parseReferences,
  sectionsMapToKnowledgePackFields,
} from "@/lib/knowledge-packs/knowledgePackDbAdapter";
import { DEVELOPER_SEED_KNOWLEDGE_PACKS } from "@/lib/knowledge-packs/developerKnowledgePacks";

describe("knowledge pack management (adapter)", () => {
  it("1. 줄바꿈 문자열이 배열로 변환된다", () => {
    expect(parseLines("a\nb\nc")).toEqual(["a", "b", "c"]);
  });

  it("2. 빈 줄은 제거된다", () => {
    expect(parseLines("a\n\n  \n b")).toEqual(["a", "b"]);
  });

  it("3. 라벨 | URL 형식이 references로 변환된다", () => {
    const raw = "AG Grid | https://www.ag-grid.com/\nBadLine\nX | https://x.test";
    expect(parseReferences(raw)).toEqual([
      { label: "AG Grid", url: "https://www.ag-grid.com/" },
      { label: "X", url: "https://x.test" },
    ]);
  });

  it("4. sectionKey별 content가 KnowledgePack 필드로 매핑된다", () => {
    const sections = knowledgePackFieldsToSections("한 줄 요약", ["라이선스 메모1"], {
      recommendedUseCases: "u1",
      constraints: "c1",
      securityChecklist: "s1",
      references: "L | https://z",
    });
    const f = sectionsMapToKnowledgePackFields(sections.map((s) => ({ sectionKey: s.key, content: s.content })));
    expect(f.summaryLines).toEqual(["한 줄 요약"]);
    expect(f.recommendedUseCases).toEqual(["u1"]);
    expect(f.constraints).toEqual(["c1"]);
    expect(f.licenseNotesFromConstraints).toEqual(["라이선스 메모1"]);
    expect(f.securityChecklist).toEqual(["s1"]);
    expect(parseReferences(f.referencesRaw)).toEqual([{ label: "L", url: "https://z" }]);
  });

  it("5. static seed id와 db id가 충돌하지 않는다", () => {
    const dbPack = dbRowToKnowledgePack({
      id: "kp_test123",
      name: "DB Pack",
      scope: "USER",
      category: "GRID",
      summary: "s",
      description: "d",
      vendor: "v",
      licenseType: "MIT",
      status: "DRAFT",
      agentsJson: '["AI_DEVELOPER"]',
      currentVersion: {
        version: "1.0.0",
        sections: [{ sectionKey: "SUMMARY", content: "요약 본문" }],
      },
    });
    const merged = mergeStaticAndDbKnowledgePacks(DEVELOPER_SEED_KNOWLEDGE_PACKS, [dbPack]);
    const ids = merged.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("6. static seed는 editable=false로 표시된다", () => {
    const merged = mergeStaticAndDbKnowledgePacks(DEVELOPER_SEED_KNOWLEDGE_PACKS, []);
    const grid = merged.find((p) => p.id === "grid.ag-grid-community");
    expect(grid?.source).toBe("STATIC");
    expect(grid?.editable).toBe(false);
  });

  it("7. DB 지식팩은 editable=true로 표시된다", () => {
    const dbPack = dbRowToKnowledgePack({
      id: "kp_only",
      name: "DB",
      scope: "USER",
      category: "API",
      summary: "sum",
      description: "",
      vendor: "",
      licenseType: "MIT",
      status: "DRAFT",
      agentsJson: '["AI_DEVELOPER"]',
      currentVersion: { version: "1.0.0", sections: [{ sectionKey: "SUMMARY", content: "sum" }] },
    });
    expect(dbPack.editable).toBe(true);
    expect(dbPack.source).toBe("DB");
  });

  it("정적 seed id는 isStaticKnowledgePackId가 true이다", () => {
    expect(isStaticKnowledgePackId("grid.ag-grid-community")).toBe(true);
    expect(isStaticKnowledgePackId("kp_abc")).toBe(false);
  });
});
