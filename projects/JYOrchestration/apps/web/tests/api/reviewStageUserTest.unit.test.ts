import { describe, expect, it } from "vitest";
import { buildImplementationReviewStageReadyMarker } from "@/lib/prototype/implementationReviewStageReady";
import {
  buildInitialReviewStageUserTestSession,
  isReviewStageEntryReady,
  markReviewStageUserTestCompleted,
  markReviewStageUserTestStarted,
  parseReviewStageUserTestSessionV1,
} from "@/lib/prototype/reviewStageUserTest";

const NOW = "2026-05-29T12:00:00.000Z";

describe("isReviewStageEntryReady", () => {
  it("ready marker + previewReady true → true", () => {
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    expect(
      isReviewStageEntryReady({
        implementationReviewStageReadyV1: marker,
        previewReady: true,
      }),
    ).toBe(true);
  });

  it("ready marker + previewReady false → false", () => {
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    expect(
      isReviewStageEntryReady({
        implementationReviewStageReadyV1: marker,
        previewReady: false,
      }),
    ).toBe(false);
  });

  it("no marker → false", () => {
    expect(isReviewStageEntryReady({ previewReady: true })).toBe(false);
  });

  it("invalid marker → false", () => {
    expect(
      isReviewStageEntryReady({
        implementationReviewStageReadyV1: {
          version: "implementation_review_stage_ready_v1",
          ready: true,
          createdAt: NOW,
          source: "execution_board_complete",
          previewReady: false,
        },
        previewReady: true,
      }),
    ).toBe(false);
  });
});

describe("reviewStageUserTestSession", () => {
  it("markReviewStageUserTestStarted sets in_progress", () => {
    const next = markReviewStageUserTestStarted({
      session: null,
      projectId: "p1",
      nowIso: NOW,
    });
    expect(next.status).toBe("in_progress");
    expect(next.startedAt).toBe(NOW);
  });

  it("markReviewStageUserTestCompleted sets completed", () => {
    const started = markReviewStageUserTestStarted({
      session: buildInitialReviewStageUserTestSession({ projectId: "p1", nowIso: NOW }),
      projectId: "p1",
      nowIso: NOW,
    });
    const done = markReviewStageUserTestCompleted({ session: started, nowIso: NOW });
    expect(done.status).toBe("completed");
    expect(done.completedAt).toBe(NOW);
  });

  it("parseReviewStageUserTestSessionV1 preserves previewUrl", () => {
    const raw = buildInitialReviewStageUserTestSession({
      projectId: "p1",
      previewUrl: "https://preview.example",
      nowIso: NOW,
    });
    expect(parseReviewStageUserTestSessionV1(raw)?.previewUrl).toBe("https://preview.example");
  });
});
