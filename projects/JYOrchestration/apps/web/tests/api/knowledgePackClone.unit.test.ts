import { describe, expect, it } from "vitest";
import { buildCreateKnowledgePackInputFromStaticSeed } from "@/lib/knowledge-packs/knowledgePackCloneService";
import { getKnowledgePackById } from "@/lib/knowledge-packs/developerKnowledgePacks";

describe("knowledgePackCloneService", () => {
  const ag = getKnowledgePackById("grid.ag-grid-community");
  it("skips when seed missing", () => {
    expect(ag).toBeTruthy();
  });

  it("buildCreateKnowledgePackInputFromStaticSeed sets USER DRAFT name and static marker in description", () => {
    if (!ag) return;
    const input = buildCreateKnowledgePackInputFromStaticSeed(ag, "grid.ag-grid-community");
    expect(input.scope).toBe("USER");
    expect(input.status).toBe("DRAFT");
    expect(input.name).toContain("내 복제본");
    expect(input.description).toContain("[Cloned from static seed: grid.ag-grid-community]");
    expect(input.sections.references).toContain("|");
  });
});
