import { describe, expect, it } from "vitest";
import {
  adviceToFlowApplyAnalyzeDispatchOptions,
  buildAdviceToFlowApplyResponsePolicy,
  isAdviceToFlowApplyMode,
  isFutureOnlyAssistantMessage,
  recentMessagesHasPriorAdviceResponse,
  shouldOmitQuickActionForAdviceToFlowApplyAnalyze,
  shouldUseAdviceToFlowApplyMode,
} from "@/lib/requirements/serviceFlowAdviceApplyMode";
import {
  validateServiceFlowAnalyzeResponse,
} from "@/lib/requirements/serviceFlowAnalyzeValidation";
import { createSampleServiceFlow } from "../orchestration/helpers/orchestrationRegressionHarness";

const adviceRecent = `AI: 검수 절차는 다음과 같습니다.

1. 자동 정리 결과 확인
- 시스템이 생성한 회의록을 확인합니다.

2. 사용자 1차 검수
- 발화자와 요약을 확인합니다.`;

function createMinApplyDraftFlow() {
  const base = createSampleServiceFlow();
  return createSampleServiceFlow({
    steps: [
      ...base.steps,
      {
        id: "s3",
        title: "Review",
        purpose: "p",
        order: 3,
        primaryActorId: "a1",
        secondaryActorIds: [],
        approved: false,
        updatedAt: base.updatedAt,
      },
    ],
  });
}

describe("serviceFlowAdviceApplyMode", () => {
  it("uses advice-to-flow apply when apply is requested but current flow has no steps", () => {
    expect(
      shouldUseAdviceToFlowApplyMode({
        executionScope: "project_single_chat",
        proposalDecision: "APPLY",
        currentFlow: createSampleServiceFlow({
          actors: [
            { id: "a1", name: "사용자", kind: "human", description: "" },
            { id: "a2", name: "시스템", kind: "system", description: "" },
          ],
          steps: [],
        }),
        recentMessages: adviceRecent,
      }),
    ).toBe(true);
  });

  it("does not use advice-to-flow apply when current flow has a minimum applyable draft", () => {
    expect(
      shouldUseAdviceToFlowApplyMode({
        executionScope: "project_single_chat",
        proposalDecision: "APPLY",
        currentFlow: createMinApplyDraftFlow(),
        recentMessages: adviceRecent,
      }),
    ).toBe(false);
  });

  it("uses advice-to-flow apply when APPLY_PROPOSAL is routed but flow has no steps", () => {
    expect(
      shouldUseAdviceToFlowApplyMode({
        executionScope: "project_single_chat",
        proposalDecision: "APPLY",
        directQuickActionId: "APPLY_PROPOSAL",
        currentFlow: createSampleServiceFlow({
          actors: [
            { id: "a1", name: "사용자", kind: "human", description: "" },
            { id: "a2", name: "시스템", kind: "system", description: "" },
          ],
          steps: [],
        }),
        recentMessages: adviceRecent,
      }),
    ).toBe(true);
  });

  it("does not use advice-to-flow apply when APPLY_PROPOSAL targets a minimum applyable draft", () => {
    expect(
      shouldUseAdviceToFlowApplyMode({
        executionScope: "project_single_chat",
        proposalDecision: "APPLY",
        directQuickActionId: "APPLY_PROPOSAL",
        currentFlow: createMinApplyDraftFlow(),
        recentMessages: adviceRecent,
      }),
    ).toBe(false);
  });

  it("builds analyze dispatch options for router-driven APPLY on empty steps", () => {
    expect(
      adviceToFlowApplyAnalyzeDispatchOptions({
        effectiveActionId: "APPLY_PROPOSAL",
        explicitDirectQuickActionId: null,
        currentFlow: createSampleServiceFlow({ steps: [] }),
        recentMessages: adviceRecent,
      }),
    ).toEqual({ omitQuickAction: true, proposalDecision: "APPLY" });
  });

  it("omits quick action for router-driven APPLY_PROPOSAL on empty steps", () => {
    expect(
      shouldOmitQuickActionForAdviceToFlowApplyAnalyze({
        effectiveActionId: "APPLY_PROPOSAL",
        explicitDirectQuickActionId: null,
        currentFlow: createSampleServiceFlow({ steps: [] }),
        recentMessages: adviceRecent,
      }),
    ).toBe(true);
    expect(
      shouldOmitQuickActionForAdviceToFlowApplyAnalyze({
        effectiveActionId: "APPLY_PROPOSAL",
        explicitDirectQuickActionId: "APPLY_PROPOSAL",
        currentFlow: createSampleServiceFlow({ steps: [] }),
        recentMessages: adviceRecent,
      }),
    ).toBe(false);
  });

  it("does not use advice-to-flow apply in pre-project scope", () => {
    expect(
      shouldUseAdviceToFlowApplyMode({
        executionScope: "pre_project",
        proposalDecision: "APPLY",
        currentFlow: null,
        recentMessages: adviceRecent,
      }),
    ).toBe(false);
  });

  it("detects structured prior advice in recent messages", () => {
    expect(recentMessagesHasPriorAdviceResponse(adviceRecent)).toBe(true);
    expect(recentMessagesHasPriorAdviceResponse("AI: 네 알겠습니다.")).toBe(false);
  });

  it("flags future-only assistant messages", () => {
    expect(isFutureOnlyAssistantMessage("서비스 흐름을 정의해 보겠습니다.")).toBe(true);
    expect(
      isFutureOnlyAssistantMessage("회의록 자동 정리 시스템의 서비스 흐름을 구체화하기 위한 초안을 제안합니다."),
    ).toBe(true);
    expect(
      isFutureOnlyAssistantMessage(
        "검수 절차를 반영했습니다.\n\n예상 흐름\n1. 업로드\n- 파일을 올립니다.\n2. 검수\n- 확인합니다.",
      ),
    ).toBe(false);
  });

  it("rejects advice-to-flow apply response with proposal-only assistant message", () => {
    const flow: ReturnType<typeof createSampleServiceFlow> = {
      ...createSampleServiceFlow(),
      steps: [],
    };
    const result = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage: "서비스 흐름을 구체화하기 위한 초안을 제안합니다.",
        updatedFlow: flow,
        intent: "unclear",
        nextQuestion: null,
        quickReplies: null,
        readiness: {
          score: 0,
          actorsReady: false,
          stepsReady: false,
          mappingReady: false,
          readyForNext: false,
        },
      },
      userMessage: "서비스 흐름에 반영해줘",
      currentFlow: flow,
      responsePolicy: { mode: "advice_to_flow_apply" },
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("assistant_future_only_no_flow");
  });

  it("builds advice_to_flow_apply response policy", () => {
    const p = buildAdviceToFlowApplyResponsePolicy();
    expect(isAdviceToFlowApplyMode(p)).toBe(true);
    expect(p.mode).toBe("advice_to_flow_apply");
  });

  it("rejects advice-to-flow apply response without steps", () => {
    const flow: ReturnType<typeof createSampleServiceFlow> = {
      ...createSampleServiceFlow(),
      steps: [],
    };
    const result = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage: "서비스 흐름을 정의해 보겠습니다.",
        updatedFlow: flow,
        intent: "unclear",
        nextQuestion: null,
        quickReplies: null,
        readiness: {
          score: 0,
          actorsReady: false,
          stepsReady: false,
          mappingReady: false,
          readyForNext: false,
        },
      },
      userMessage: "좋아 생성해줘",
      currentFlow: flow,
      responsePolicy: { mode: "advice_to_flow_apply" },
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("advice_to_flow_apply_missing_steps");
  });

  it("accepts advice-to-flow apply response with actors and steps", () => {
    const base = createSampleServiceFlow();
    const flow = createSampleServiceFlow({
      steps: [
        ...base.steps,
        {
          id: "s3",
          title: "Review",
          purpose: "p",
          order: 3,
          primaryActorId: "a1",
          secondaryActorIds: [],
          approved: false,
          updatedAt: base.updatedAt,
        },
      ],
    });
    const actorNames = flow.actors.map((a) => a.name).join(" ");
    const stepTitles = flow.steps.map((s) => s.title).join(" ");
    const result = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage: `검수 절차를 서비스 흐름 초안으로 반영했습니다.\n\n예상 액터\n- ${actorNames}\n\n예상 흐름\n${flow.steps.map((s, i) => `${i + 1}. ${s.title}\n- ${s.description ?? "처리"}`).join("\n")}`,
        updatedFlow: flow,
        intent: "add_step",
        nextQuestion: null,
        quickReplies: ["이대로 진행", "수정"],
        readiness: {
          score: 40,
          actorsReady: true,
          stepsReady: true,
          mappingReady: true,
          readyForNext: false,
        },
      },
      userMessage: "좋아 생성해줘",
      currentFlow: createSampleServiceFlow({ steps: [] }),
      responsePolicy: { mode: "advice_to_flow_apply" },
    });
    expect(result.ok).toBe(true);
    void stepTitles;
  });
});
