import { describe, expect, it } from "vitest";
import {
  buildExecutionReviewOverlayWarningSummary,
  type ExecutionReviewerStepRecord,
} from "@/lib/execution/executionReviewWithAiMembers";

describe("buildExecutionReviewOverlayWarningSummary", () => {
  it("aggregates counts and byRole across steps without affecting step shape", () => {
    const steps: ExecutionReviewerStepRecord[] = [
      {
        memberId: "a",
        name: "R1",
        role: "reviewer",
        model: "m",
        decision: "done",
        summary: "s",
        issues: [],
        reviewedAt: "2026-01-01T00:00:00.000Z",
        overlayPolicyWarnings: [
          {
            code: "W1",
            severity: "warning",
            message: "m1",
            roleKey: "reviewer",
            source: "review-harness",
            enforcement: "not_applied",
          },
        ],
      },
      {
        memberId: "b",
        name: "R2",
        role: "quality-reviewer",
        model: "m",
        decision: "done",
        summary: "s2",
        issues: [],
        reviewedAt: "2026-01-01T00:00:01.000Z",
        overlayPolicyWarnings: [
          {
            code: "W2",
            severity: "info",
            message: "m2",
            roleKey: "quality-reviewer",
            source: "review-harness",
            enforcement: "not_applied",
          },
          {
            code: "W3",
            severity: "critical",
            message: "m3",
            roleKey: "quality-reviewer",
            source: "review-harness",
            enforcement: "not_applied",
          },
        ],
      },
    ];
    const s = buildExecutionReviewOverlayWarningSummary(steps);
    expect(s.total).toBe(3);
    expect(s.warning).toBe(1);
    expect(s.info).toBe(1);
    expect(s.critical).toBe(1);
    expect(s.byRole.reviewer).toBe(1);
    expect(s.byRole["quality-reviewer"]).toBe(2);
  });

  it("returns zeros when no overlay warnings", () => {
    const s = buildExecutionReviewOverlayWarningSummary([
      {
        memberId: "a",
        name: "R1",
        role: "reviewer",
        model: "m",
        decision: "done",
        summary: "s",
        issues: [],
        reviewedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    expect(s.total).toBe(0);
    expect(s.critical).toBe(0);
    expect(s.warning).toBe(0);
    expect(s.info).toBe(0);
    expect(Object.keys(s.byRole).length).toBe(0);
  });
});
