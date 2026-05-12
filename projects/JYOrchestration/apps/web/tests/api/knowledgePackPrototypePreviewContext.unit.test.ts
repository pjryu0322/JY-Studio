import { describe, expect, it } from "vitest";
import { buildPrototypeKnowledgePackQueryBlob } from "@/lib/knowledge-packs/knowledgePackPrototypePreviewContext";

describe("buildPrototypeKnowledgePackQueryBlob", () => {
  it("joins name, description, ideation, flow, features within max length", () => {
    const s = buildPrototypeKnowledgePackQueryBlob({
      projectName: "PN",
      projectDescription: "PD",
      ideationAssets: [{ title: "A", content: "B" }],
      flowSteps: [{ title: "S1", purpose: "P1" }],
      featureDraftTitles: ["f1", "f2"],
    });
    expect(s).toContain("PN");
    expect(s).toContain("PD");
    expect(s).toContain("A: B");
    expect(s).toContain("S1: P1");
    expect(s).toContain("f1");
    expect(s.length).toBeLessThanOrEqual(12_000);
  });
});
