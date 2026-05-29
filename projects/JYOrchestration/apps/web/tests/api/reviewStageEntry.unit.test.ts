import { describe, expect, it } from "vitest";
import { buildImplementationReviewStageReadyMarker } from "@/lib/prototype/implementationReviewStageReady";
import { buildReviewStageEntryNoticeLines } from "@/lib/prototype/reviewStageEntry";
import { markReviewStageUserTestStarted } from "@/lib/prototype/reviewStageUserTest";

const NOW = "2026-05-29T12:00:00.000Z";

describe("buildReviewStageEntryNoticeLines", () => {
  it("includes Preview URL when entry ready", () => {
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    const session = markReviewStageUserTestStarted({
      session: null,
      projectId: "p1",
      previewUrl: "https://preview.example/app",
      nowIso: NOW,
    });
    const lines = buildReviewStageEntryNoticeLines({
      implementationReviewStageReadyV1: marker,
      previewReady: true,
      session,
      previewUrl: "https://preview.example/app",
    });
    expect(lines.some((line) => line.includes("https://preview.example/app"))).toBe(true);
  });

  it("warning lines when entry not ready", () => {
    const lines = buildReviewStageEntryNoticeLines({
      implementationReviewStageReadyV1: null,
      previewReady: false,
    });
    expect(lines.some((line) => line.includes("아직 검토단계"))).toBe(true);
  });
});
