import { describe, expect, it } from "vitest";
import {
  isVirtualKnowledgePackSourceId,
  parseKnowledgePackSourceRouteId,
  virtualKnowledgePackSourceId,
} from "@/lib/knowledge-packs/knowledgePackSourceRouteUtils";

describe("knowledgePackSourceRouteUtils", () => {
  it("virtualKnowledgePackSourceId matches isVirtualKnowledgePackSourceId", () => {
    const id = virtualKnowledgePackSourceId("grid.foo", 0);
    expect(isVirtualKnowledgePackSourceId(id)).toBe(true);
    expect(id).toContain("grid.foo");
  });

  it("parseKnowledgePackSourceRouteId decodes", () => {
    expect(parseKnowledgePackSourceRouteId(encodeURIComponent("abc"))).toBe("abc");
  });
});
