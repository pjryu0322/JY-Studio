import { describe, expect, it } from "vitest";
import { generateKnowledgePackDraftMock } from "@/lib/knowledge-packs/knowledgePackDraftGenerator";

const agents = ["AI_DEVELOPER"] as const;

describe("generateKnowledgePackDraftMock precheck warnings", () => {
  it("LIMITED_REGISTERABLE includes policy warning line", () => {
    const d = generateKnowledgePackDraftMock({
      productName: "X",
      category: "GRID",
      agents: [...agents],
      precheckDecision: "LIMITED_REGISTERABLE",
      precheckRiskLevel: "MEDIUM",
    });
    expect(d.warnings.some((w) => w.includes("제한 등록"))).toBe(true);
  });

  it("USER_SOURCE_REQUIRED includes user document warning", () => {
    const d = generateKnowledgePackDraftMock({
      productName: "X",
      category: "GRID",
      agents: [...agents],
      precheckDecision: "USER_SOURCE_REQUIRED",
      precheckRiskLevel: "MEDIUM",
    });
    expect(d.warnings.some((w) => w.includes("매뉴얼/API 명세"))).toBe(true);
  });

  it("NOT_RECOMMENDED includes strong warning", () => {
    const d = generateKnowledgePackDraftMock({
      productName: "X",
      category: "GRID",
      agents: [...agents],
      precheckDecision: "NOT_RECOMMENDED",
      precheckRiskLevel: "CRITICAL",
    });
    expect(d.warnings.some((w) => w.includes("등록 비권장") && w.includes("강함"))).toBe(true);
  });

  it("security review flag adds AI보안관 line", () => {
    const d = generateKnowledgePackDraftMock({
      productName: "X",
      category: "GRID",
      agents: [...agents],
      precheckDecision: "REGISTERABLE",
      precheckRequiresSecurityReview: true,
    });
    expect(d.warnings.some((w) => w.includes("AI보안관"))).toBe(true);
  });

  it("license review flag adds 라이선스 line", () => {
    const d = generateKnowledgePackDraftMock({
      productName: "X",
      category: "GRID",
      agents: [...agents],
      precheckDecision: "REGISTERABLE",
      precheckRequiresLicenseReview: true,
    });
    expect(d.warnings.some((w) => w.includes("라이선스/약관 검토"))).toBe(true);
  });
});
