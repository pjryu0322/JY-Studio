import { describe, expect, it } from "vitest";
import { parseKnowledgePackDraftRequestBody } from "@/lib/knowledge-packs/knowledgePackDraftHttpBody";
import { generateKnowledgePackDraftMock } from "@/lib/knowledge-packs/knowledgePackDraftGenerator";
import { parseKnowledgePackPrecheckRequestBody, parsePrecheckSummaryForHistory } from "@/lib/knowledge-packs/knowledgePackPrecheckHttpBody";
import { precheckKnowledgePackRegistration } from "@/lib/knowledge-packs/knowledgePackPrecheckService";

const agents = ["AI_DEVELOPER"] as const;

describe("parseKnowledgePackPrecheckRequestBody", () => {
  it("1. rejects empty productName", () => {
    const r = parseKnowledgePackPrecheckRequestBody({ productName: "  ", category: "GRID", agents: ["AI_DEVELOPER"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/제품명/);
  });

  it("rejects invalid category", () => {
    const r = parseKnowledgePackPrecheckRequestBody({ productName: "X", category: "NOT_A_CAT", agents: [] });
    expect(r.ok).toBe(false);
  });

  it("formats precheckSummary for history line", () => {
    expect(
      parsePrecheckSummaryForHistory({
        precheckSummary: { decision: "LIMITED_REGISTERABLE", riskLevel: "HIGH", score: 68 },
      })
    ).toBe("Precheck: LIMITED_REGISTERABLE / HIGH / 68");
  });
});

describe("precheckKnowledgePackRegistration", () => {
  it("2. GRID + product URL + MIT hint tends toward REGISTERABLE with LOW/MEDIUM risk", async () => {
    const r = await precheckKnowledgePackRegistration({
      productName: "TOAST UI Grid",
      category: "GRID",
      agents: [...agents],
      productUrl: "https://ui.toast.com/tui-grid",
      licenseHint: "MIT",
    });
    expect(r.decision).toBe("REGISTERABLE");
    expect(["LOW", "MEDIUM"]).toContain(r.riskLevel);
  });

  it("3. AUTH category is LIMITED_REGISTERABLE or HIGH risk", async () => {
    const r = await precheckKnowledgePackRegistration({
      productName: "Corp SSO",
      category: "AUTH",
      agents: [...agents],
      productUrl: "https://example.com",
      officialDocsUrl: "https://example.com/docs",
    });
    expect(r.decision).toBe("LIMITED_REGISTERABLE");
    expect(r.riskLevel).toBe("HIGH");
  });

  it("4. Kakao Login style input includes auth / redirect style issues", async () => {
    const r = await precheckKnowledgePackRegistration({
      productName: "Kakao Login",
      category: "API",
      agents: [...agents],
      purpose: "Kakao OAuth Redirect URI 연동",
      apiDocsUrl: "https://developers.kakao.com/docs",
    });
    const blob = r.issues.map((i) => `${i.type} ${i.title}`).join("\n");
    expect(blob).toMatch(/AUTH_SECRET_RISK|Redirect|인증|토큰|Secret/i);
  });

  it("5. payment / finance keywords yield CRITICAL risk and LIMITED when URLs exist", async () => {
    const r = await precheckKnowledgePackRegistration({
      productName: "Checkout",
      category: "API",
      agents: [...agents],
      memo: "PG 결제 및 오픈뱅킹 연동",
      apiDocsUrl: "https://example.com/api",
    });
    expect(r.riskLevel).toBe("CRITICAL");
    expect(r.decision).toBe("LIMITED_REGISTERABLE");
  });

  it("payment without public URLs → USER_SOURCE_REQUIRED and CRITICAL", async () => {
    const r = await precheckKnowledgePackRegistration({
      productName: "PayOnly",
      category: "API",
      agents: [...agents],
      memo: "PG 결제 연동",
    });
    expect(r.decision).toBe("USER_SOURCE_REQUIRED");
    expect(r.riskLevel).toBe("CRITICAL");
    expect(r.shouldRequireSecurityReview).toBe(true);
    expect(r.shouldRequireLicenseReview).toBe(true);
    expect(r.shouldRequireUserProvidedDocs).toBe(true);
  });

  it("AUTH + Kakao-style text dedupes AUTH_SECRET_RISK to a single issue type", async () => {
    const r = await precheckKnowledgePackRegistration({
      productName: "Kakao Login",
      category: "AUTH",
      agents: [...agents],
      purpose: "OAuth redirect 및 token",
      productUrl: "https://developers.kakao.com",
    });
    expect(r.issues.filter((i) => i.type === "AUTH_SECRET_RISK").length).toBe(1);
  });

  it("6. product name only (no URLs) → USER_SOURCE_REQUIRED", async () => {
    const r = await precheckKnowledgePackRegistration({
      productName: "Internal CRM",
      category: "DATA",
      agents: [...agents],
    });
    expect(r.decision).toBe("USER_SOURCE_REQUIRED");
  });

  it("7. enterprise / commercial keywords include license review style issues", async () => {
    const r = await precheckKnowledgePackRegistration({
      productName: "Vendor X",
      category: "UI",
      agents: [...agents],
      purpose: "enterprise commercial license required",
      productUrl: "https://vendor.example",
    });
    const types = r.issues.map((i) => i.type).join(",");
    expect(types).toMatch(/COMMERCIAL_LICENSE_RISK|TERMS_REVIEW_REQUIRED/);
  });

  it("8. personal data keywords include PERSONAL_DATA_RISK", async () => {
    const r = await precheckKnowledgePackRegistration({
      productName: "CRM",
      category: "DATA",
      agents: [...agents],
      memo: "개인정보 및 이메일 수집",
      productUrl: "https://crm.example",
    });
    expect(r.issues.some((i) => i.type === "PERSONAL_DATA_RISK")).toBe(true);
  });

  it("9. NOT_RECOMMENDED implies canGenerateDraft false", async () => {
    const r = await precheckKnowledgePackRegistration({
      productName: "Bad",
      category: "GRID",
      agents: [...agents],
      memo: "불법 크랙 배포",
    });
    expect(r.decision).toBe("NOT_RECOMMENDED");
    expect(r.canGenerateDraft).toBe(false);
  });

  it("10. requiredSources, recommendedSources, nextActions are never all empty", async () => {
    const samples = [
      { productName: "A", category: "GRID" as const, agents: [...agents] },
      {
        productName: "B",
        category: "AUTH" as const,
        agents: [...agents],
        productUrl: "https://b.example",
      },
    ];
    for (const s of samples) {
      const r = await precheckKnowledgePackRegistration(s);
      expect(r.requiredSources.length).toBeGreaterThan(0);
      expect(r.recommendedSources.length).toBeGreaterThan(0);
      expect(r.nextActions.length).toBeGreaterThan(0);
    }
  });
});

describe("draft body + precheck meta", () => {
  it("parses optional precheck fields on draft POST body", () => {
    const r = parseKnowledgePackDraftRequestBody({
      productName: "P",
      category: "GRID",
      agents: [],
      precheckDecision: "LIMITED_REGISTERABLE",
      precheckRiskLevel: "HIGH",
      precheckIssues: ["약관 확인"],
      precheckRequiresSecurityReview: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.precheckDecision).toBe("LIMITED_REGISTERABLE");
      expect(r.input.precheckRiskLevel).toBe("HIGH");
      expect(r.input.precheckIssueSummaries).toEqual(["약관 확인"]);
      expect(r.input.precheckRequiresSecurityReview).toBe(true);
    }
  });

  it("accepts precheckIssueSummaries alias", () => {
    const r = parseKnowledgePackDraftRequestBody({
      productName: "P",
      category: "GRID",
      agents: [],
      precheckIssueSummaries: ["a"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.precheckIssueSummaries).toEqual(["a"]);
  });

  it("generateKnowledgePackDraftMock merges precheck warnings", () => {
    const d = generateKnowledgePackDraftMock({
      productName: "T",
      category: "GRID",
      agents: [...agents],
      precheckDecision: "USER_SOURCE_REQUIRED",
      precheckRiskLevel: "MEDIUM",
      precheckIssues: ["문서 부족: 공개 URL 없음"],
    });
    expect(d.warnings.some((w) => w.includes("공개 자료만으로는 부족합니다"))).toBe(true);
    expect(d.sourceCandidates).toMatch(/사용자 원천자료/);
  });
});
