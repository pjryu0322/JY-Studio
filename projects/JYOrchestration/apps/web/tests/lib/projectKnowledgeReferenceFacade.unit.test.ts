import { describe, expect, it } from "vitest";
import { buildProjectReferenceAssessment } from "@/lib/project-knowledge/projectKnowledgeReferenceCandidateService";
import { getLatestReferenceKnowledgeGraphRevision } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";

describe("Phase 5.6 knowledge reference facades", () => {
  it("re-exports assessment from candidate service facade", () => {
    expect(typeof buildProjectReferenceAssessment).toBe("function");
  });

  it("re-exports reference revision query from graph revision facade", () => {
    expect(typeof getLatestReferenceKnowledgeGraphRevision).toBe("function");
  });
});
