import { describe, expect, it } from "vitest";
import {
  assertTimelineMetadata,
  buildTransitionTimelineMetadata,
  createMockOrchestrationState,
  createSampleServiceFlow,
  dispatchQuickAction,
  type OrchestrationTimelineMetadata,
} from "../helpers/orchestrationRegressionHarness";

const REQUIRED_TIMELINE_KEYS: readonly (keyof OrchestrationTimelineMetadata)[] = [
  "quickActionId",
  "quickActionLabel",
  "transitionSignal",
  "transitionTriggered",
  "fromStage",
  "toStage",
  "projectionUpdated",
];

describe("orchestration regression — timeline metadata", () => {
  it("APPROVE_FLOW fast-path emits complete transition audit fields", () => {
    const flow = createSampleServiceFlow({ conversationState: "REVIEW" });
    const state = createMockOrchestrationState({ stage: "SERVICE_FLOW_REVIEW", flow });
    const result = dispatchQuickAction({
      state,
      currentFlow: flow,
      quickActionId: "APPROVE_FLOW",
      quickActionLabel: "흐름 확정",
    });

    const meta = buildTransitionTimelineMetadata({
      quickActionId: "APPROVE_FLOW",
      quickActionLabel: "흐름 확정",
      transitionResult: result,
      transitionMeta:
        result.fastPath && "transitionMeta" in result.fastPath
          ? (result.fastPath.transitionMeta ?? null)
          : null,
    });

    assertTimelineMetadata(meta, REQUIRED_TIMELINE_KEYS);
    expect(meta.transitionSignal).toBe("FLOW_APPROVE");
    expect(meta.fromStage).toBeTruthy();
    expect(meta.toStage).toBeTruthy();
    expect(meta.projectionUpdated === true || meta.slotSyncTriggered === true).toBe(true);
  });

  it("NEXT_STAGE records stage transition metadata without label-based signal", () => {
    const flow = createSampleServiceFlow({
      conversationState: "APPROVED",
      flowApproved: true,
    });
    const state = createMockOrchestrationState({ stage: "SERVICE_FLOW_REVIEW", flow });
    const result = dispatchQuickAction({
      state,
      currentFlow: flow,
      quickActionId: "NEXT_STAGE",
      quickActionLabel: "다음 단계 진행",
    });

    const meta = buildTransitionTimelineMetadata({
      quickActionId: "NEXT_STAGE",
      quickActionLabel: "다음 단계 진행",
      transitionResult: result,
      transitionMeta:
        result.fastPath && "transitionMeta" in result.fastPath
          ? (result.fastPath.transitionMeta ?? null)
          : null,
    });

    expect(meta.quickActionId).toBe("NEXT_STAGE");
    expect(meta.transitionTriggered).toBe(true);
    expect(meta.transitionSignal).toBe("NEXT_STAGE");
    expect(meta.toStage).toBe("FEATURE_DETAIL");
    expect(meta.staleTriggered).not.toBe(true);
  });
});
