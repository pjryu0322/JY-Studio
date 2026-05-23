import { describe, expect, it } from "vitest";
import {
  buildSlotAwareQuickReplies,
  decideSingleChatSlotNextAction,
  evaluateGenerationReadinessFromSlots,
} from "@/lib/requirements/singleChatSlotNextAction";
import {
  initialOrchestrationStateFromDefinitions,
  mergeOrchestrationSlotPatches,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import {
  createDefaultSlotDefinitions,
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../orchestration/helpers/orchestrationRegressionHarness";

function sampleReviewableFlow() {
  return createSampleServiceFlow({
    conversationState: "REVIEW",
    steps: [
      {
        id: "s1",
        title: "Upload",
        purpose: "p",
        order: 1,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: ORCHESTRATION_REGRESSION_NOW,
      },
      {
        id: "s2",
        title: "Analyze",
        purpose: "p",
        order: 2,
        primaryActorId: "a2",
        secondaryActorIds: [],
        approved: false,
        updatedAt: ORCHESTRATION_REGRESSION_NOW,
      },
      {
        id: "s3",
        title: "Review",
        purpose: "검수",
        order: 3,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: ORCHESTRATION_REGRESSION_NOW,
      },
    ],
  });
}

describe("singleChatSlotNextAction", () => {
  const definitions = createDefaultSlotDefinitions();

  it("prioritizes planning core before flow approval when planning slots are missing", () => {
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, ORCHESTRATION_REGRESSION_NOW);
    const decision = decideSingleChatSlotNextAction({
      orchestration,
      definitions,
      flow: sampleReviewableFlow(),
    });

    expect(decision.focusArea).toBe("planning");
    expect(decision.ownerAgent).toBe("planner");
    expect(decision.shouldSuppressFlowApprove).toBe(true);
    expect(decision.quickReplies).toContain("기획 핵심 정리");
  });

  it("hides flow approve when planning core is not ready", () => {
    const actions = buildSlotAwareQuickReplies({
      conversationQuickReplies: ["흐름 확정", "단계 수정하기"],
      decision: {
        shouldSuppressFlowApprove: true,
        quickReplies: ["기획 핵심 정리", "흐름 보완"],
      },
    });

    expect(actions).not.toContain("흐름 확정");
    expect(actions).toContain("기획 핵심 정리");
  });

  it("allows next stage style actions after planning core and analysis flow are ready", () => {
    const purposeKey = definitions.find((d) => d.slotKey.endsWith(".planning.servicePurpose"))!.slotKey;
    const problemKey = definitions.find((d) => d.slotKey.endsWith(".planning.problem"))!.slotKey;
    const usersKey = definitions.find((d) => d.slotKey.endsWith(".planning.coreUsers"))!.slotKey;
    const outcomeKey = definitions.find((d) => d.slotKey.endsWith(".planning.expectedOutcome"))!.slotKey;
    const flowKey = definitions.find((d) => d.slotKey.endsWith(".flow.serviceFlow"))!.slotKey;

    let orchestration = initialOrchestrationStateFromDefinitions(definitions, ORCHESTRATION_REGRESSION_NOW);
    orchestration = mergeOrchestrationSlotPatches({
      base: orchestration,
      definitions,
      nowIso: ORCHESTRATION_REGRESSION_NOW,
      patches: [
        { slotKey: purposeKey, status: "partial", value: "회의록 자동 요약 서비스 목적" },
        { slotKey: problemKey, status: "partial", value: "수동 정리 부담 문제" },
        { slotKey: usersKey, status: "partial", value: "회의 참석자" },
        { slotKey: outcomeKey, status: "partial", value: "요약 시간 단축" },
        { slotKey: flowKey, status: "partial", value: "업로드-분석-검수 흐름" },
      ],
    });

    const decision = decideSingleChatSlotNextAction({
      orchestration,
      definitions,
      flow: sampleReviewableFlow(),
    });

    expect(decision.focusArea).toMatch(/architecture|design/);
    expect(decision.shouldSuppressFlowApprove).toBe(false);
    expect(decision.quickReplies).toContain("기능 범위 정리");
  });

  it("maps generation readiness required fields to planning slots", () => {
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, ORCHESTRATION_REGRESSION_NOW);
    const readiness = evaluateGenerationReadinessFromSlots({ orchestration, definitions });
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toContain("주 사용자");
  });
});
