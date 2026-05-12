import { describe, expect, it } from "vitest";

import { getKnowledgePackById } from "@/lib/knowledge-packs/developerKnowledgePacks";
import {
  inferSourceTypeFromReference,
  referencesToKnowledgePackSources,
  resolveKnowledgePackSourcesForDisplay,
} from "@/lib/knowledge-packs/knowledgePackSources";
import type { KnowledgePack, KnowledgePackSource } from "@/lib/knowledge-packs/types";

describe("knowledgePackSources (RAG 준비 유틸)", () => {
  const agPack = getKnowledgePackById("grid.ag-grid-community")!;

  it("1. referencesToKnowledgePackSources는 references 개수만큼 sources를 만든다", () => {
    const s = referencesToKnowledgePackSources(agPack);
    expect(s.length).toBe(agPack.references.length);
  });

  it("2. source id는 `${pack.id}.source.N` 형식이다", () => {
    const s = referencesToKnowledgePackSources(agPack);
    s.forEach((src, i) => {
      expect(src.id).toBe(`${agPack.id}.source.${i + 1}`);
    });
  });

  it("3. knowledgePackId는 pack.id와 같다", () => {
    for (const src of referencesToKnowledgePackSources(agPack)) {
      expect(src.knowledgePackId).toBe(agPack.id);
    }
  });

  it("4. title은 reference label과 같다", () => {
    agPack.references.forEach((ref, i) => {
      expect(referencesToKnowledgePackSources(agPack)[i]?.title).toBe(ref.label);
    });
  });

  it("5. url은 reference url과 같다", () => {
    agPack.references.forEach((ref, i) => {
      expect(referencesToKnowledgePackSources(agPack)[i]?.url).toBe(ref.url);
    });
  });

  it("6. license URL/label은 LICENSE로 추론된다", () => {
    expect(inferSourceTypeFromReference("AG Grid Community License", "https://www.ag-grid.com/eula/AG-Grid-Community-License.html")).toBe("LICENSE");
  });

  it("7. API 문서는 API_REFERENCE로 추론된다", () => {
    expect(inferSourceTypeFromReference("REST API", "https://developers.kakao.com/docs/latest/ko/rest-api/README")).toBe("API_REFERENCE");
  });

  it("8. GitHub 링크는 CODE_SAMPLE로 추론된다", () => {
    expect(inferSourceTypeFromReference("tui.grid", "https://github.com/nhn/tui.grid")).toBe("CODE_SAMPLE");
  });

  it("9. docs/document 링크는 MANUAL로 추론된다", () => {
    expect(inferSourceTypeFromReference("가이드", "https://example.com/docs/getting-started")).toBe("MANUAL");
    expect(inferSourceTypeFromReference("Official document", "https://example.com/document/1")).toBe("MANUAL");
  });

  it("10. 기본값은 URL이다", () => {
    expect(inferSourceTypeFromReference("뉴스", "https://news.example.com/world")).toBe("URL");
  });

  it("11. ragEnabled는 true다", () => {
    for (const src of referencesToKnowledgePackSources(agPack)) {
      expect(src.ragEnabled).toBe(true);
    }
  });

  it("12. isOfficial은 true다", () => {
    for (const src of referencesToKnowledgePackSources(agPack)) {
      expect(src.isOfficial).toBe(true);
    }
  });

  it("resolveKnowledgePackSourcesForDisplay는 pack.sources가 있으면 우선한다", () => {
    const custom: KnowledgePack = {
      ...agPack,
      sources: [
        {
          id: "custom.1",
          knowledgePackId: agPack.id,
          sourceType: "MANUAL",
          title: "직접 등록",
          isOfficial: false,
          ragEnabled: false,
        },
      ] as const satisfies readonly KnowledgePackSource[],
    };
    const r = resolveKnowledgePackSourcesForDisplay(custom);
    expect(r.length).toBe(1);
    expect(r[0]?.id).toBe("custom.1");
  });
});
