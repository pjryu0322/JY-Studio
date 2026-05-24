import { describe, expect, it } from "vitest";
import {
  buildFastPlanGenerationContext,
  buildFastPlanMarkdown,
  generateFastPlanFromCurrentContext,
  runForceGeneratePlanNowForTest,
  runOrganizeStartGenerateFinalProposalForTest,
} from "@/lib/requirements/fastPlanGeneration";
import { collectFastPlanFieldSnapshots } from "@/lib/requirements/fastPlanSlotAssumptions";
import { buildDynamicServicePlanningSlotDefinitions } from "@/lib/requirements/singleChatOrchestrationSlots";
import type { RequirementsSingleChatOrchestrationStateV1 } from "@/lib/requirements/singleChatOrchestrationTypes";

const nowIso = "2026-05-24T12:00:00.000Z";
const slotDefinitions = buildDynamicServicePlanningSlotDefinitions({
  projectId: "proj-1",
  projectName: "회의록 서비스",
});

function orchestrationWithMissingPlanningCore(): RequirementsSingleChatOrchestrationStateV1 {
  const base = {
    version: 2 as const,
    stageGroup: "service-planning",
    slotDefinitionsHash: "test",
    slots: {} as RequirementsSingleChatOrchestrationStateV1["slots"],
    baseSlotKeys: slotDefinitions.map((d) => d.slotKey),
  };
  for (const def of slotDefinitions) {
    if (def.slotKey.endsWith(".planning.servicePurpose")) {
      base.slots[def.slotKey] = {
        slotKey: def.slotKey,
        ownerAgent: def.ownerAgent,
        stageGroup: def.stageGroup,
        label: def.label,
        status: "candidate",
        value: "회의록을 자동으로 정리하는 서비스",
        updatedAt: nowIso,
      };
    } else {
      base.slots[def.slotKey] = {
        slotKey: def.slotKey,
        ownerAgent: def.ownerAgent,
        stageGroup: def.stageGroup,
        label: def.label,
        status: "empty",
        value: null,
        updatedAt: nowIso,
      };
    }
  }
  return base;
}

describe("fastPlanGeneration", () => {
  it("onForceGeneratePlanNow uses fast path even when ideation gate is not ready", () => {
    const result = runForceGeneratePlanNowForTest({
      gateReady: false,
      slotReadinessMissing: ["주 사용자", "핵심 문제", "기대 효과"],
      generate: () =>
        generateFastPlanFromCurrentContext({
          projectId: "proj-1",
          projectName: "회의록 서비스",
          projectDescription: "회의 내용을 요약·공유",
          conversationMessages: [{ role: "user", body: "회의록 작성자가 쓸 서비스입니다." }],
          serviceFlow: null,
          orchestration: orchestrationWithMissingPlanningCore(),
          slotDefinitions,
          featurePlanning: null,
          problemInterview: null,
          nowIso,
        }),
    });

    expect(result.mode).toBe("fast_plan_from_current_context");
    expect(result.blockedByStrictGate).toBe(false);
  });

  it("creates assumptions for missing planning slots", () => {
    const context = buildFastPlanGenerationContext({
      projectId: "proj-1",
      projectName: "회의록 서비스",
      projectDescription: "회의 내용을 요약·공유",
      conversationMessages: [{ role: "user", body: "팀 리더와 작성자가 사용합니다." }],
      serviceFlow: null,
      orchestration: orchestrationWithMissingPlanningCore(),
      slotDefinitions,
      featurePlanning: null,
      problemInterview: null,
      nowIso,
    });

    expect(context.assumptions.some((a) => a.label.includes("주 사용자"))).toBe(true);
    expect(
      context.assumptions.every(
        (a) => a.confidence === "assumed_for_prototype" || a.confidence === "candidate",
      ),
    ).toBe(true);
  });

  it("builds fast prototype plan with assumptions section", () => {
    const collected = collectFastPlanFieldSnapshots({
      orchestration: orchestrationWithMissingPlanningCore(),
      definitions: slotDefinitions,
      interview: null,
      projectName: "회의록 서비스",
      projectDescription: "회의 요약",
      conversationMessages: [],
      serviceFlow: null,
    });
    const context = buildFastPlanGenerationContext({
      projectId: "proj-1",
      projectName: "회의록 서비스",
      projectDescription: "회의 요약",
      conversationMessages: [],
      serviceFlow: null,
      orchestration: orchestrationWithMissingPlanningCore(),
      slotDefinitions,
      featurePlanning: null,
      problemInterview: null,
      nowIso,
    });
    const md = buildFastPlanMarkdown({
      projectName: "회의록 서비스",
      context: { ...context, assumptions: collected.assumptions },
    });

    expect(md).toContain("# 기획안");
    expect(md).toContain("## 8. AI 보완 후보/가정");
    expect(md).toContain("현재 기획안으로 프로토타입 만들기");
  });

  it("keeps strict gate for organizeStartGenerateFinalProposal", () => {
    const result = runOrganizeStartGenerateFinalProposalForTest({
      gateReady: false,
    });

    expect(result.blockedByStrictGate).toBe(true);
  });
});
