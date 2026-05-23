import { describe, expect, it } from "vitest";
import {
  normalizeProjectSingleChatStageIntent,
  resolveProjectSingleChatCtaId,
  routeProjectSingleChatStage,
} from "@/lib/requirements/singleChatStageRouter";
import { createSampleServiceFlow } from "../orchestration/helpers/orchestrationRegressionHarness";
import {
  assistantClaimsFlowConcrete,
  validateServiceFlowAnalyzeResponse,
} from "@/lib/requirements/serviceFlowAnalyzeValidation";
import { buildScreenPlanningAssistantMessage } from "@/lib/requirements/screenPlanningResponse";

describe("singleChatStageRouter", () => {
  it("routes screen composition request to screen_planning instead of service_flow", () => {
    const flow = createSampleServiceFlow();
    const result = routeProjectSingleChatStage({
      executionScope: "project_single_chat",
      currentStage: "service_flow",
      latestUserMessage: "화면 구성 해줘",
      routerIntentType: "question",
      routerExecutionIntent: "ask_advice",
      routerStageIntent: "screen_planning",
      currentFlow: flow,
    });

    expect(result.stageIntent).toBe("screen_planning");
    expect(result.shouldRunServiceFlowAnalyze).toBe(false);
    expect(result.shouldRouteToScreenPlanning).toBe(true);
  });

  it("does not review empty flow and requests flow draft generation first", () => {
    const result = routeProjectSingleChatStage({
      executionScope: "project_single_chat",
      currentStage: "service_flow",
      latestUserMessage: "흐름 검토하기",
      directCtaId: "FLOW_REVIEW",
      currentFlow: createSampleServiceFlow({ steps: [] }),
      recentMessages: `AI: 검수 절차는 다음과 같습니다.

1. 자동 정리 결과 확인
- 시스템이 생성한 회의록을 확인합니다.

2. 사용자 1차 검수
- 발화자와 요약을 확인합니다.`,
    });

    expect(result.shouldRunAdviceToFlowApply).toBe(true);
    expect(result.shouldRunFlowReview).toBe(false);
  });

  it("runs flow review when draft has minimum steps", () => {
    const base = createSampleServiceFlow();
    const result = routeProjectSingleChatStage({
      executionScope: "project_single_chat",
      latestUserMessage: "흐름 검토하기",
      directCtaId: "FLOW_REVIEW",
      currentFlow: createSampleServiceFlow({
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
      }),
    });

    expect(result.stageIntent).toBe("flow_review");
    expect(result.shouldRunFlowReview).toBe(true);
    expect(result.shouldRunServiceFlowAnalyze).toBe(true);
  });

  it("does not treat typed text exact label as direct CTA by default", () => {
    expect(
      resolveProjectSingleChatCtaId({
        userMessage: "흐름 검토하기",
        allowUserMessageLegacyCtaMatch: false,
      }),
    ).toBe(null);
  });

  it("resolves explicit directCtaId", () => {
    expect(
      resolveProjectSingleChatCtaId({
        directCtaId: "FLOW_REVIEW",
        userMessage: "흐름 검토하기",
      }),
    ).toBe("FLOW_REVIEW");
  });

  it("resolves FLOW_REVIEW cta from legacy label when legacy match enabled", () => {
    expect(
      resolveProjectSingleChatCtaId({
        userMessage: "흐름 검토하기",
        allowUserMessageLegacyCtaMatch: true,
      }),
    ).toBe("FLOW_REVIEW");
  });

  it("normalizes unknown stage intent to general_advice", () => {
    expect(normalizeProjectSingleChatStageIntent("unknown_stage")).toBe("general_advice");
  });
});

describe("screenPlanningResponse (smoke)", () => {
  it("builds deterministic screen planning with at least three numbered screens", () => {
    const body = buildScreenPlanningAssistantMessage({
      projectName: "회의록",
      flow: createSampleServiceFlow(),
    });
    expect(body).toMatch(/화면 구성/);
    expect((body.match(/(^|\n)\s*\d+\.\s+/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("serviceFlowAnalyzeValidation — flow claim", () => {
  it("rejects assistant claiming flow concretized when updatedFlow has no steps", () => {
    const flow = createSampleServiceFlow({ steps: [] });
    expect(
      assistantClaimsFlowConcrete("회의록 자동 정리 시스템의 서비스 흐름을 구체화하였습니다. 검토해 주세요."),
    ).toBe(true);
    const result = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage: "회의록 자동 정리 시스템의 서비스 흐름을 구체화하였습니다. 검토해 주세요.",
        updatedFlow: flow,
        intent: "show_summary",
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
      userMessage: "흐름 검토하기",
      currentFlow: flow,
      responsePolicy: { mode: "flow_update" },
    });
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("assistant_claims_flow_without_steps");
  });
});
