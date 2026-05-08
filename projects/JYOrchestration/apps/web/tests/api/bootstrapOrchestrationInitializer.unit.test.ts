import { describe, expect, it } from "vitest";
import { dedupeParticipatingAgentsForPrompt } from "@/lib/requirements/singleChatAgentContext";
import {
  buildCompactBootstrapSlotCatalogForLlm,
  buildDynamicServicePlanningSlotDefinitions,
  computeSlotExpansionPhaseFromState,
  filterSlotDefinitionsForPlannerCatalog,
  initialOrchestrationStateFromDefinitions,
  internalOwnerToLlmExternalRole,
  isBootstrapPhase1CatalogSlotKey,
  mergeOrchestrationSlotPatches,
  stringifyCompactBootstrapSlotCatalogForLlm,
  stringifyPlannerRouteSlotCatalogForLlm,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { buildIdeationBootstrapContextualFallbackQuestion } from "@/lib/requirements/requirementsIdeationBootstrapPromptTimeline";
import { isModelReturnedSlotCatalogPayload } from "@/lib/project/requirementsAiFacilitatorOpenAI";

describe("bootstrap orchestration initializer", () => {
  it("dedupe: 동일 displayName+외부 역할이면 provider/model이 풍부한 한 줄만 남긴다", () => {
    const merged = dedupeParticipatingAgentsForPrompt([
      {
        source: "catalog",
        catalogKey: "ideation",
        displayName: "AI 기획자",
        aiOrchestrationRole: "planner",
        aiProvider: "openai",
        aiModelOverride: null,
        orchestrationStage: null,
        aiAgentKey: null,
        enginePreference: null,
      },
      {
        source: "project_member",
        displayName: "AI 기획자",
        aiOrchestrationRole: "planner",
        aiProvider: "openai",
        aiModelOverride: "GPT-5",
        orchestrationStage: "spec",
        aiAgentKey: "x",
        enginePreference: null,
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.aiModelOverride).toBe("GPT-5");
    expect(merged[0]?.source).toBe("project_member");
  });

  it("내부 owner → LLM 외부 6역할만", () => {
    expect(internalOwnerToLlmExternalRole("solution-architect")).toBe("architect");
    expect(internalOwnerToLlmExternalRole("service-designer")).toBe("analyst");
    expect(internalOwnerToLlmExternalRole("task-reviewer")).toBe("reviewer");
    expect(internalOwnerToLlmExternalRole("security-reviewer")).toBe("security");
  });

  it("compact bootstrap catalog: dependsOn 미포함·deep design 슬롯 제외", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "DemoProj",
      projectDescription: "x",
      projectType: "web",
      servicePlanningAgentCatalogKeys: ["designer", "security_reviewer"],
    });
    const json = stringifyCompactBootstrapSlotCatalogForLlm(defs);
    expect(json.includes("dependsOn")).toBe(false);
    expect(json.includes("informationArchitecture")).toBe(false);
    expect(json.includes("implementationRisk")).toBe(false);
    expect(json.includes("featureDependencies")).toBe(false);
    expect(json.includes("dataFlow")).toBe(false);
    const rows = buildCompactBootstrapSlotCatalogForLlm(defs);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(defs.filter((d) => !d.slotKey.startsWith("dyn_")).length);
    for (const r of rows) {
      expect(["planner", "analyst", "architect", "designer", "reviewer", "security"]).toContain(r.ownerAgent);
    }
  });

  it("Phase1 카탈로그 키만 isBootstrapPhase1CatalogSlotKey 통과", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "K",
      projectDescription: "",
      projectType: null,
    });
    const kPurpose = defs.find((d) => d.slotKey.endsWith(".planning.servicePurpose"))?.slotKey;
    const kIa = defs.find((d) => d.label === "정보 구조(IA)")?.slotKey;
    expect(kPurpose && isBootstrapPhase1CatalogSlotKey(kPurpose)).toBe(true);
    if (kIa) expect(isBootstrapPhase1CatalogSlotKey(kIa)).toBe(false);
  });

  it("planner-route용 카탈로그: phase1은 planning만·dependsOn 생략", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "Cat",
      projectDescription: "",
      projectType: null,
    });
    const p1 = filterSlotDefinitionsForPlannerCatalog(defs, 1);
    expect(p1.every((d) => d.slotKey.includes(".planning."))).toBe(true);
    const json = stringifyPlannerRouteSlotCatalogForLlm(defs, 1);
    expect(json.includes("dependsOn")).toBe(false);
    const json3 = stringifyPlannerRouteSlotCatalogForLlm(defs, 3);
    expect(json3.includes(".flow.")).toBe(true);
  });

  it("computeSlotExpansionPhaseFromState: 초기=1, 플로우 채우면 2", () => {
    const defs = buildDynamicServicePlanningSlotDefinitions({
      projectName: "P",
      projectDescription: "",
      projectType: null,
    });
    const ts = "2026-05-08T00:00:00.000Z";
    let state = initialOrchestrationStateFromDefinitions(defs, ts);
    expect(computeSlotExpansionPhaseFromState(state, defs)).toBe(1);
    const flowKey = defs.find((d) => d.slotKey.includes(".flow.serviceFlow"))?.slotKey;
    expect(flowKey).toBeTruthy();
    state = mergeOrchestrationSlotPatches({
      base: state,
      patches: [{ slotKey: flowKey!, status: "partial", value: "단계 A→B", confidence: 0.5 }],
      nowIso: ts,
    });
    expect(computeSlotExpansionPhaseFromState(state, defs)).toBe(2);
  });

  it("fallback 첫 질문: 설명이 있을 때 ‘주요 문제 정의’ 같은 재질문 문구를 쓰지 않는다", () => {
    const q = buildIdeationBootstrapContextualFallbackQuestion({
      projectName: "회의록 서비스",
      projectDescription: "회의록 작성 시간이 너무 오래 걸린다",
      projectType: "saas",
    });
    expect(q).not.toMatch(/주요 문제 정의/);
    expect(q.length).toBeGreaterThan(10);
  });

  it("classifies slots-only bootstrap response as MODEL_RETURNED_SLOT_CATALOG", () => {
    expect(
      isModelReturnedSlotCatalogPayload({
        mode: "bootstrap_phase1_compact",
        slots: [{ slotKey: "planning.servicePurpose", label: "서비스 목적" }],
      })
    ).toBe(true);
    expect(
      isModelReturnedSlotCatalogPayload({
        question: "누가 최종 확정하나요?",
        mode: "bootstrap_phase1_compact",
        slots: [{ slotKey: "planning.servicePurpose", label: "서비스 목적" }],
      })
    ).toBe(false);
  });
});
