import { describe, expect, it } from "vitest";

import { DEVELOPER_SEED_KNOWLEDGE_PACKS } from "@/lib/knowledge-packs/developerGridPacks";
import { knowledgePackToMarkdown } from "@/lib/knowledge-packs/knowledgePackMarkdown";

describe("knowledgePackToMarkdown", () => {
  it("includes title, id, and major sections for seed packs", () => {
    for (const pack of DEVELOPER_SEED_KNOWLEDGE_PACKS) {
      const md = knowledgePackToMarkdown(pack);
      expect(md).toContain(`# ${pack.name}`);
      expect(md).toContain(pack.id);
      expect(md).toContain("## 요약");
      expect(md).toContain("## 구현 지침");
      expect(md).toContain("## 검수 체크리스트");
    }
  });
});
