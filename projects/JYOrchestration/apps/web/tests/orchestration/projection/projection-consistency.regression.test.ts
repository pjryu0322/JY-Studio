import { describe, expect, it } from "vitest";
import {
  assertAllowedActions,
  assertObsoleteActionsRemoved,
  buildProjection,
  createMockOrchestrationState,
  createSampleServiceFlow,
  FEATURE_DETAIL_ALLOWED_ACTION_IDS,
  FEATURE_DETAIL_OBSOLETE_ACTION_IDS,
  filterActionsForStage,
  projectionSnapshotSlice,
} from "../helpers/orchestrationRegressionHarness";
import { resolveAuthoritativeOrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";

describe("orchestration regression — projection consistency", () => {
  it("projection derives from authoritative orchestration state, not conversation labels", () => {
    const state = createMockOrchestrationState({ stage: "FEATURE_DETAIL" });
    expect(resolveAuthoritativeOrchestrationStage(state)).toBe("FEATURE_DETAIL");

    const view = buildProjection({ state });
    assertAllowedActions("FEATURE_DETAIL", view.quickActions);
    assertObsoleteActionsRemoved("FEATURE_DETAIL", view.quickActions);
    expect(view.quickActions.map((a) => a.id)).toEqual([...FEATURE_DETAIL_ALLOWED_ACTION_IDS]);
  });

  it("projection snapshot slice — deterministic structure", () => {
    const state = createMockOrchestrationState({ stage: "SERVICE_FLOW_REVIEW" });
    const slice = projectionSnapshotSlice(buildProjection({ state }));
    expect(slice).toMatchInlineSnapshot(`
      {
        "authoritativeStage": "SERVICE_FLOW_REVIEW",
        "orchestrationAligned": false,
        "progressPercent": 0,
        "progressWeighted": 0,
        "quickActionIds": [
          "APPROVE_FLOW",
          "EDIT_STEPS",
          "ADD_ACTOR",
          "REVIEW_FLOW",
          "START_FEATURE_DETAIL",
        ],
        "quickReplyProfile": "review",
        "statusCounts": {
          "candidate": 0,
          "confirmed": 0,
          "empty": 27,
          "partial": 0,
          "stale": 0,
          "total": 27,
        },
        "workspaceStage": "service-flow",
      }
    `);
  });

  it("polluted action list filtered by actionId only in FEATURE_DETAIL", () => {
    const polluted = [
      ...FEATURE_DETAIL_OBSOLETE_ACTION_IDS.map((id) => ({
        id,
        label: `label-for-${id}`,
      })),
      ...FEATURE_DETAIL_ALLOWED_ACTION_IDS.map((id) => ({
        id,
        label: `label-for-${id}`,
      })),
    ];
    const filtered = filterActionsForStage("FEATURE_DETAIL", polluted);
    expect(filtered.map((a) => a.id)).toEqual([...FEATURE_DETAIL_ALLOWED_ACTION_IDS]);
  });
});
