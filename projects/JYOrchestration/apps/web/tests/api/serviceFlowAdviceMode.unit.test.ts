import { describe, expect, it } from "vitest";
import { guardRequirementsAction } from "@/lib/requirements/requirementsActionGuard";
import {
  buildRequirementsIntentDispatchContext,
  dispatchRequirementsUserIntent,
} from "@/lib/requirements/requirementsIntentDispatch";
import {
  buildServiceFlowAdviceSystemPromptBlock,
  buildServiceFlowResponsePolicyFromDispatch,
  flowForServiceFlowAnalyzePrompt,
  isServiceFlowAdviceMode,
  isWeakAdviceAssistantMessage,
  mergeServiceFlowResponsePolicy,
  shouldOmitQuickActionForAdviceAnalyze,
  shouldUseServiceFlowAdviceMode,
} from "@/lib/requirements/serviceFlowAdviceMode";
import type { IntentRoutingResult } from "@/lib/requirements/requirementsIntentRouterTypes";
import {
  createSampleServiceFlow,
  ORCHESTRATION_REGRESSION_NOW,
} from "../orchestration/helpers/orchestrationRegressionHarness";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

function serviceFlowProposalState(): RequirementsStateJson {
  return {
    serviceFlowV1: createSampleServiceFlow({ conversationState: "PROPOSAL" }),
    requirementsOrchestrationStageV1: {
      currentStage: "IDEATION",
      activePhase: "IDEATION",
      completedStages: [],
      updatedAt: ORCHESTRATION_REGRESSION_NOW,
    },
  };
}

function intent(partial: Partial<IntentRoutingResult>): IntentRoutingResult {
  return {
    intentType: "question",
    suggestedActionId: null,
    confidence: 0.9,
    reason: "test",
    routerMode: "llm",
    ...partial,
  };
}

describe("serviceFlowAdviceMode", () => {
  it("uses advice mode for ask_advice direct input without direct quick action", () => {
    expect(
      shouldUseServiceFlowAdviceMode({
        directQuickActionId: null,
        effectiveActionId: "DIRECT_INPUT",
        executionIntent: "ask_advice",
        strongActionGuarded: false,
      }),
    ).toBe(true);
  });

  it("shouldOmitQuickActionForAdviceAnalyze when advice DIRECT_INPUT downgrade", () => {
    expect(
      shouldOmitQuickActionForAdviceAnalyze({
        serviceFlowResponseMode: "advice",
        effectiveActionId: "DIRECT_INPUT",
      }),
    ).toBe(true);
    expect(
      shouldOmitQuickActionForAdviceAnalyze({
        serviceFlowResponseMode: "flow_update",
        effectiveActionId: "DIRECT_INPUT",
      }),
    ).toBe(false);
  });

  it("does not use advice mode for direct quick action generate alternative", () => {
    expect(
      shouldUseServiceFlowAdviceMode({
        directQuickActionId: "GENERATE_ALTERNATIVE",
        effectiveActionId: "GENERATE_ALTERNATIVE",
        executionIntent: "ask_compare",
        strongActionGuarded: false,
      }),
    ).toBe(false);
  });

  it("mergeResponsePolicy prefers opts (b) over harness (a)", () => {
    expect(
      mergeServiceFlowResponsePolicy({ mode: "flow_update" }, { mode: "advice", strongActionGuarded: true }),
    ).toEqual({ mode: "advice", strongActionGuarded: true });
  });

  it("advice prompt block includes Advice Response Mode policy", () => {
    const block = buildServiceFlowAdviceSystemPromptBlock();
    expect(block).toContain("Advice Response Mode");
    expect(block).toContain("단계별");
    expect(block).toContain("대안 비교");
  });

  it("flowForServiceFlowAnalyzePrompt omits alternative payload for advice", () => {
    const flow = createSampleServiceFlow({
      alternativeProposalPayload: { proposalId: "alt-1" } as never,
    });
    const stripped = flowForServiceFlowAnalyzePrompt(flow, { mode: "advice" });
    expect(stripped?.alternativeProposalPayload).toBeNull();
    expect(flowForServiceFlowAnalyzePrompt(flow, { mode: "flow_update" })?.alternativeProposalPayload).toBeTruthy();
  });

  it("isWeakAdviceAssistantMessage flags short declaration-only text", () => {
    expect(isWeakAdviceAssistantMessage("검수 절차를 제안합니다.")).toBe(true);
    expect(
      isWeakAdviceAssistantMessage(
        "1. 자동 변환 결과 확인\n- 녹취가 텍스트로 변환되었는지 확인합니다.\n2. 발화자별 정리 검수\n- 발화자명이 올바른지 확인합니다.\n3. 주제별 요약 검수\n- 회의 주제와 요약이 일치하는지 확인합니다.\n4. TODO 검수\n- 담당·기한이 명확한지 확인합니다.\n5. 최종 확정\n- 수정본을 저장하고 공유합니다.",
      ),
    ).toBe(false);
  });

  it("dispatch: strong action downgrade yields advice response policy", () => {
    const state = serviceFlowProposalState();
    const ctx = buildRequirementsIntentDispatchContext(state);
    const routedIntent = intent({
      suggestedActionId: "GENERATE_ALTERNATIVE",
      executionIntent: "ask_advice",
      actionInvocationStrength: "weak",
    });
    const baseGuard = guardRequirementsAction({
      suggestedActionId: "GENERATE_ALTERNATIVE",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      featureMetrics: ctx.featureMetrics,
    });
    const policy = buildServiceFlowResponsePolicyFromDispatch({
      intent: routedIntent,
      guard: { ...baseGuard, warning: "downgraded" },
      effectiveActionId: "DIRECT_INPUT",
      directQuickActionId: null,
    });
    expect(policy.mode).toBe("advice");
    expect(policy.strongActionGuarded).toBe(true);
    expect(isServiceFlowAdviceMode(policy)).toBe(true);
  });

  it("dispatch integration: mock intent metadata surfaces advice mode on DIRECT_INPUT downgrade", () => {
    const state = serviceFlowProposalState();
    const ctx = buildRequirementsIntentDispatchContext(state);
    const dispatch = dispatchRequirementsUserIntent({
      userMessage: "검수절차를 제안해줘",
      ctx,
      routingState: state,
    });
    void dispatch;
    const mockIntent = intent({
      suggestedActionId: "GENERATE_ALTERNATIVE",
      executionIntent: "ask_advice",
      actionInvocationStrength: "weak",
    });
    const guard = guardRequirementsAction({
      suggestedActionId: "GENERATE_ALTERNATIVE",
      authoritativeStage: ctx.authoritativeStage,
      availableActionIds: ctx.availableActionIds,
      featureMetrics: ctx.featureMetrics,
    });
    const policy = buildServiceFlowResponsePolicyFromDispatch({
      intent: mockIntent,
      guard: { ...guard, warning: "blocked", effectiveActionId: "DIRECT_INPUT" },
      effectiveActionId: "DIRECT_INPUT",
    });
    expect(policy.mode).toBe("advice");
  });
});
