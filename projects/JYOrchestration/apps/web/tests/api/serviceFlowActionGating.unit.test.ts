import { describe, expect, it } from "vitest";
import {
  buildServiceFlowGatedQuickReplyLabels,
  canApplyServiceFlowProposal,
  filterQuickReplyLabelsForServiceFlowGating,
  resolveBlockedApplyRedirect,
  shouldShowServiceFlowApplyActions,
} from "@/lib/requirements/serviceFlowActionGating";
import { shouldBlockStrongActionForServiceFlowSubIntent } from "@/lib/requirements/serviceFlowSubIntent";
import {
  assistantClaimsFlowReady,
  validateServiceFlowAnalyzeResponse,
} from "@/lib/requirements/serviceFlowAnalyzeValidation";
import { createSampleServiceFlow } from "../orchestration/helpers/orchestrationRegressionHarness";

describe("serviceFlowActionGating", () => {
  const sampleActors = [
    { id: "a1", name: "사용자", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "a2", name: "시스템", updatedAt: "2026-01-01T00:00:00.000Z" },
  ];

  it("does not show apply actions when flow has actors but no steps", () => {
    const flow = createSampleServiceFlow({ actors: sampleActors, steps: [] });
    expect(shouldShowServiceFlowApplyActions(flow)).toBe(false);
    expect(canApplyServiceFlowProposal(flow).allowed).toBe(false);
  });

  it("shows apply actions only for reviewable flow", () => {
    const base = createSampleServiceFlow();
    const reviewable = createSampleServiceFlow({
      actors: base.actors,
      steps: [
        ...base.steps,
        {
          id: "s3",
          title: "검수",
          purpose: "p",
          order: 3,
          primaryActorId: "a1",
          secondaryActorIds: [],
          approved: false,
          updatedAt: base.updatedAt,
        },
      ],
    });
    expect(shouldShowServiceFlowApplyActions(reviewable)).toBe(true);
  });

  it("filters apply/alternative quick reply labels when not reviewable", () => {
    const flow = createSampleServiceFlow({ actors: sampleActors, steps: [] });
    const filtered = filterQuickReplyLabelsForServiceFlowGating(
      ["이 대안 적용", "다른 대안 다시 생성", "단계 정리하기"],
      flow,
    );
    expect(filtered).toEqual(["단계 정리하기"]);
  });

  it("redirects apply request to flow_step_definition when actors exist but steps are missing", () => {
    const result = resolveBlockedApplyRedirect({
      suggestedActionId: "APPLY_PROPOSAL",
      currentFlow: createSampleServiceFlow({ actors: sampleActors, steps: [] }),
    });
    expect(result?.effectiveActionId).toBe("DIRECT_INPUT");
    expect(result?.serviceFlowSubIntent).toBe("flow_step_definition");
  });

  it("suggests step-definition chips when actors exist but steps are missing", () => {
    const labels = buildServiceFlowGatedQuickReplyLabels(
      createSampleServiceFlow({ actors: sampleActors, steps: [] }),
    );
    expect(labels).toContain("단계 정리하기");
    expect(labels).not.toContain("이 대안 적용");
  });
});

describe("serviceFlowSubIntent — strong action guard", () => {
  it("downgrades GENERATE_ALTERNATIVE to DIRECT_INPUT for flow_draft", () => {
    const result = shouldBlockStrongActionForServiceFlowSubIntent({
      suggestedActionId: "GENERATE_ALTERNATIVE",
      serviceFlowSubIntent: "flow_draft",
      currentFlow: createSampleServiceFlow({ steps: [] }),
    });

    expect(result.blocked).toBe(true);
    expect(result.downgradedTo).toBe("DIRECT_INPUT");
    expect(result.reason).toBe("flow_draft_is_not_alternative");
  });
});

describe("serviceFlowAnalyzeValidation — reviewable claims", () => {
  it("rejects assistant claiming flow ready without reviewable state", () => {
    const actors = [
      { id: "a1", name: "사용자", updatedAt: "2026-01-01T00:00:00.000Z" },
      { id: "a2", name: "시스템", updatedAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(
      assistantClaimsFlowReady("기본 운영 흐름이 정리되었습니다. 추가 수정사항이 있으면 말씀해 주세요."),
    ).toBe(true);

    const result = validateServiceFlowAnalyzeResponse({
      parsed: {
        assistantMessage: "기본 운영 흐름이 정리되었습니다. 추가 수정사항이 있으면 말씀해 주세요.",
        updatedFlow: { createdAt: "", updatedAt: "", actors, steps: [] },
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
      userMessage: "서비스 흐름 초안 만들기",
      currentFlow: null,
      responsePolicy: { mode: "flow_update", serviceFlowSubIntent: "flow_draft" },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("assistant_claims_reviewable_flow_without_reviewable_state");
  });
});
