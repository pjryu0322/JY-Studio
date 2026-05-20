import { describe, expect, it } from "vitest";
import {
  assertApproveFlowOutcome,
  buildTransitionTimelineMetadata,
  createMockOrchestrationState,
  createSampleServiceFlow,
  dispatchQuickAction,
} from "../helpers/orchestrationRegressionHarness";

describe("orchestration regression — quick-action transition", () => {
  const flow = createSampleServiceFlow({ conversationState: "REVIEW" });

  it.each([
    { label: "흐름 승인하기", caseId: "legacy-alias-label" },
    { label: "흐름 확정", caseId: "current-default-label" },
  ])("APPROVE_FLOW with label=$label yields identical transition ($caseId)", ({ label }) => {
    const state = createMockOrchestrationState({ stage: "SERVICE_FLOW_REVIEW", flow });
    const result = dispatchQuickAction({
      state,
      currentFlow: flow,
      quickActionId: "APPROVE_FLOW",
      quickActionLabel: label,
    });

    assertApproveFlowOutcome(result);
    expect(result.signal?.payload).toMatchObject({
      quickActionId: "APPROVE_FLOW",
      proposalDecision: "FLOW_APPROVE",
    });

    const meta = buildTransitionTimelineMetadata({
      quickActionId: "APPROVE_FLOW",
      quickActionLabel: label,
      transitionResult: result,
      transitionMeta:
        result.fastPath && "transitionMeta" in result.fastPath
          ? (result.fastPath.transitionMeta ?? null)
          : null,
    });
    expect(meta.quickActionId).toBe("APPROVE_FLOW");
    expect(meta.quickActionLabel).toBe(label);
    expect(meta.transitionSignal).toBe("FLOW_APPROVE");
    expect(meta.transitionTriggered).toBe(true);
  });
});
