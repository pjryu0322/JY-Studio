import { describe, expect, it } from "vitest";
import { guardRequirementsAction } from "@/lib/requirements/requirementsActionGuard";
import {
  buildRequirementsIntentDispatchContext,
  dispatchRequirementsUserIntent,
} from "@/lib/requirements/requirementsIntentDispatch";
import { canUseServiceFlowAnalyze } from "@/lib/conversation/conversationScopeBoundary";
import {
  buildServiceFlowAdviceSystemPromptBlock,
  buildServiceFlowResponsePolicyFromDispatch,
  flowForServiceFlowAnalyzePrompt,
  isServiceFlowAdviceMode,
  isWeakAdviceAssistantMessage,
  mergeServiceFlowAdviceUserFacingMessage,
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
  it("service-flow advice mode is project single chat scoped", () => {
    expect(canUseServiceFlowAnalyze("project_single_chat")).toBe(true);
    expect(canUseServiceFlowAnalyze("pre_project")).toBe(false);
  });

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
    expect(block).toContain("[Advice Output Format]");
    expect(block).toContain("번호 목록");
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

  it("flags long paragraph without numbered structure as weak advice", () => {
    const text =
      "검수 절차를 다음과 같이 구성할 수 있습니다. 첫 번째 단계는 시스템이 자동으로 정리한 회의록을 사용자에게 제공하는 것입니다. 두 번째 단계는 사용자가 검토하는 것입니다. 세 번째 단계는 검수자가 최종 검토하는 것입니다.";
    expect(isWeakAdviceAssistantMessage(text)).toBe(true);
  });

  it("does not duplicate nextQuestion when assistant already includes the same question", () => {
    const merged = mergeServiceFlowAdviceUserFacingMessage(
      "검수 절차는 다음과 같습니다.\n\n다음: 이 절차를 서비스 흐름에 반영할까요?",
      "이 절차를 서비스 흐름에 반영할까요?",
    );
    expect(merged.match(/서비스 흐름에 반영할까요/g)?.length).toBe(1);
  });

  it("adds nextQuestion once when assistant does not include it", () => {
    const merged = mergeServiceFlowAdviceUserFacingMessage(
      "검수 절차는 다음과 같습니다.\n\n1. 자동 정리 결과 확인\n- 결과를 확인합니다.",
      "이 절차를 서비스 흐름에 반영할까요?",
    );
    expect(merged).toContain("다음: 이 절차를 서비스 흐름에 반영할까요?");
    expect(merged.match(/서비스 흐름에 반영할까요/g)?.length).toBe(1);
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
