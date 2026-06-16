import { describe, expect, it } from "vitest";
import {
  buildProductDefinitionFromChatDraft,
  buildProductDefinitionStubFromProject,
  evaluateProductDefinitionReadiness,
  isProductDefinitionCompleteIntent,
  parseProductDefinitionV1,
} from "@/lib/requirements/productDefinitionV1";
import { buildInitialProductDefinitionOrchestrationStage } from "@/lib/requirements/productDefinitionOrchestration";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

describe("productDefinitionV1", () => {
  it("parses stub from project create flow", () => {
    const stub = buildProductDefinitionStubFromProject({ productName: "회의록 SaaS", description: "회의 자동 정리" });
    const parsed = parseProductDefinitionV1(stub);
    expect(parsed?.overview.productName).toBe("회의록 SaaS");
    expect(evaluateProductDefinitionReadiness(parsed).ready).toBe(false);
  });

  it("builds from chat draft with problem and features", () => {
    const def = buildProductDefinitionFromChatDraft({
      productName: "회의록",
      description: "desc",
      draft: {
        version: 1,
        titleCandidates: ["회의록"],
        chosenTitle: "회의록",
        description: "회의 자동 정리 서비스",
        problem: "회의록 작성 부담",
        targetUsers: "PM",
        valueProposition: "자동 요약",
        mvpScope: "업로드·요약",
        explicitExclusions: "결제",
        featureCandidates: ["업로드", "STT", "요약"],
        openQuestions: [],
        assumptions: [],
        confirmedFacts: [],
        recommendedAiMembers: [],
        nextSteps: ["데모"],
      },
    });
    expect(def.overview.problemToSolve.value).toContain("회의록");
    expect(def.coreFeatures.items.length).toBe(3);
  });

  it("stores orchestration wire PRODUCT_DEFINITION in requirements state", () => {
    const st = parseRequirementsStateJson({
      requirementsOrchestrationStageV1: buildInitialProductDefinitionOrchestrationStage("2026-06-03T00:00:00.000Z"),
      productDefinitionV1: buildProductDefinitionStubFromProject({ productName: "A" }),
    });
    expect(st.requirementsOrchestrationStageV1?.currentStage).toBe("PRODUCT_DEFINITION");
    expect(st.productDefinitionV1?.overview.productName).toBe("A");
  });

  it("detects planning entry intent", () => {
    expect(isProductDefinitionCompleteIntent("기획 단계로 진행")).toBe(true);
    expect(isProductDefinitionCompleteIntent("hello")).toBe(false);
  });
});
