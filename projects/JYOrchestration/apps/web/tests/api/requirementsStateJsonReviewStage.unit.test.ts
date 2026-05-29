import { describe, expect, it } from "vitest";
import { buildImplementationReviewStageReadyMarker } from "@/lib/prototype/implementationReviewStageReady";
import {
  buildInitialReviewStageUserTestSession,
  markReviewStageUserTestStarted,
  parseReviewStageUserTestSessionV1,
} from "@/lib/prototype/reviewStageUserTest";
import { appendReviewStageUserFeedback, parseReviewStageUserFeedbackListV1 } from "@/lib/prototype/reviewStageUserFeedback";
import { buildPrototypeExecutionOrchestrationPersistPatch } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

const NOW = "2026-05-29T12:00:00.000Z";

describe("requirementsStateJson review stage fields", () => {
  it("parseRequirementsStateJson parses reviewStageUserTestSessionV1", () => {
    const session = markReviewStageUserTestStarted({
      session: buildInitialReviewStageUserTestSession({ projectId: "p1", nowIso: NOW }),
      projectId: "p1",
      nowIso: NOW,
    });
    const state = parseRequirementsStateJson({ reviewStageUserTestSessionV1: session });
    expect(state.reviewStageUserTestSessionV1?.status).toBe("in_progress");
  });

  it("parseRequirementsStateJson parses reviewStageUserFeedbackListV1", () => {
    const list = appendReviewStageUserFeedback({
      list: null,
      projectId: "p1",
      title: "t",
      detail: "d",
      nowIso: NOW,
    });
    const state = parseRequirementsStateJson({ reviewStageUserFeedbackListV1: list });
    expect(state.reviewStageUserFeedbackListV1?.items).toHaveLength(1);
  });

  it("mergeRequirementsStateJson preserves review stage fields", () => {
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    const session = buildInitialReviewStageUserTestSession({ projectId: "p1", nowIso: NOW });
    const list = appendReviewStageUserFeedback({
      list: null,
      projectId: "p1",
      title: "t",
      detail: "d",
      nowIso: NOW,
    });
    const merged = mergeRequirementsStateJson(parseRequirementsStateJson({}), {
      implementationReviewStageReadyV1: marker,
      reviewStageUserTestSessionV1: session,
      reviewStageUserFeedbackListV1: list,
    });
    expect(merged.implementationReviewStageReadyV1?.ready).toBe(true);
    expect(merged.reviewStageUserTestSessionV1?.projectId).toBe("p1");
    expect(merged.reviewStageUserFeedbackListV1?.items[0]?.title).toBe("t");
  });

  it("buildPrototypeExecutionOrchestrationPersistPatch includes review stage fields", () => {
    const session = parseReviewStageUserTestSessionV1(
      buildInitialReviewStageUserTestSession({ projectId: "p1", nowIso: NOW }),
    );
    const list = appendReviewStageUserFeedback({
      list: null,
      projectId: "p1",
      title: "t",
      detail: "d",
      nowIso: NOW,
    });
    const patch = buildPrototypeExecutionOrchestrationPersistPatch(
      {},
      {
        reviewStageUserTestSessionV1: session ?? null,
        reviewStageUserFeedbackListV1: list,
      },
    );
    expect(patch.reviewStageUserTestSessionV1?.version).toBe("review_stage_user_test_session_v1");
    expect(patch.reviewStageUserFeedbackListV1?.items).toHaveLength(1);
  });
});
