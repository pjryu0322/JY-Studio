import { describe, expect, it } from "vitest";
import { generateKnowledgePackDraftMock } from "@/lib/knowledge-packs/knowledgePackDraftGenerator";

const baseAgents = ["AI_DEVELOPER"] as const;

describe("generateKnowledgePackDraftMock", () => {
  it("1. productName is required at type level; mock expects non-empty trimmed name in callers", () => {
    const r = generateKnowledgePackDraftMock({
      productName: "X",
      category: "UI",
      agents: [...baseAgents],
    });
    expect(r.summary.length).toBeGreaterThan(0);
  });

  it("2. GRID category produces grid-oriented implementation guidance", () => {
    const r = generateKnowledgePackDraftMock({
      productName: "Test Grid",
      category: "GRID",
      agents: [...baseAgents],
    });
    expect(r.implementationGuidelines).toMatch(/Grid|그리드|조회/i);
    expect(r.capabilities).toMatch(/정렬|필터|페이지/i);
  });

  it("3. AUTH category includes Secret/Token/Redirect-related forbidden patterns", () => {
    const r = generateKnowledgePackDraftMock({
      productName: "Kakao",
      category: "AUTH",
      agents: [...baseAgents],
    });
    const joined = `${r.forbiddenPatterns}\n${r.constraints}`;
    expect(joined).toMatch(/Secret|Redirect|Token|프론트/i);
  });

  it("4. API / INTEGRATION includes Request/Response/Error scenario style content", () => {
    for (const category of ["API", "INTEGRATION"] as const) {
      const r = generateKnowledgePackDraftMock({
        productName: "Payments API",
        category,
        agents: [...baseAgents],
      });
      const blob = `${r.capabilities}\n${r.implementationGuidelines}\n${r.forbiddenPatterns}`;
      expect(blob).toMatch(/Request|Response|에러|Error|타임아웃|Retry/i);
    }
  });

  it("5. productUrl appears in references when provided", () => {
    const url = "https://example.com/product";
    const r = generateKnowledgePackDraftMock({
      productName: "P",
      category: "UI",
      agents: [...baseAgents],
      productUrl: url,
    });
    expect(r.references).toContain(url);
    expect(r.references).toMatch(/공식 제품 URL/);
  });

  it("6. officialDocsUrl appears in references when provided", () => {
    const url = "https://docs.example.com";
    const r = generateKnowledgePackDraftMock({
      productName: "P",
      category: "UI",
      agents: [...baseAgents],
      officialDocsUrl: url,
    });
    expect(r.references).toContain(url);
    expect(r.references).toMatch(/공식 문서 URL/);
  });

  it("7. apiDocsUrl appears in references when provided", () => {
    const url = "https://api.example.com/docs";
    const r = generateKnowledgePackDraftMock({
      productName: "P",
      category: "API",
      agents: [...baseAgents],
      apiDocsUrl: url,
    });
    expect(r.references).toContain(url);
    expect(r.references).toMatch(/API 문서 URL/);
  });

  it("8. repositoryUrl appears in references when provided", () => {
    const url = "https://github.com/org/repo";
    const r = generateKnowledgePackDraftMock({
      productName: "P",
      category: "UI",
      agents: [...baseAgents],
      repositoryUrl: url,
    });
    expect(r.references).toContain(url);
    expect(r.references).toMatch(/GitHub\/npm URL/);
  });

  it("9. warnings include license/security review phrasing", () => {
    const r = generateKnowledgePackDraftMock({
      productName: "P",
      category: "SECURITY",
      agents: [...baseAgents],
    });
    const text = r.warnings.join("\n");
    expect(text).toMatch(/라이선스|보안|공식 문서/i);
    expect(text).toMatch(/API Key|Secret|개인정보/i);
  });

  it("10. major string sections are non-empty", () => {
    const r = generateKnowledgePackDraftMock({
      productName: "Full",
      category: "DATA",
      agents: ["AI_DEVELOPER", "AI_ANALYST"],
      purpose: "분석",
    });
    expect(r.summary.trim()).not.toBe("");
    expect(r.licenseNotes.trim()).not.toBe("");
    expect(r.recommendedUseCases.trim()).not.toBe("");
    expect(r.notRecommendedUseCases.trim()).not.toBe("");
    expect(r.capabilities.trim()).not.toBe("");
    expect(r.constraints.trim()).not.toBe("");
    expect(r.implementationGuidelines.trim()).not.toBe("");
    expect(r.cursorPromptRules.trim()).not.toBe("");
    expect(r.forbiddenPatterns.trim()).not.toBe("");
    expect(r.reviewChecklist.trim()).not.toBe("");
    expect(r.securityChecklist.trim()).not.toBe("");
    expect(r.alternatives.trim()).not.toBe("");
    expect(r.previewSpec.trim()).not.toBe("");
    expect(r.sourceCandidates.trim()).not.toBe("");
  });
});
