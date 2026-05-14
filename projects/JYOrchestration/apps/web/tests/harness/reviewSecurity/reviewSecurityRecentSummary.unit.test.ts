import { describe, expect, it } from "vitest";

import { summarizeRecentReviewSecurityPlans } from "@/lib/harness/reviewSecurity/reviewSecurityRecentSummary";
import type { ReviewSecurityHarnessPlan } from "@/lib/harness/reviewSecurity/reviewSecurityHarnessTypes";

function plan(opts: {
  readonly checklist?: ReviewSecurityHarnessPlan["checklist"];
  readonly findings?: ReviewSecurityHarnessPlan["findings"];
}): ReviewSecurityHarnessPlan {
  return {
    mode: "dry_run_review_security",
    roleKey: "reviewer",
    workspaceStage: null,
    checklist: opts.checklist ?? [],
    findings: opts.findings ?? [],
  };
}

const sample = (over: {
  readonly id: string;
  readonly area: ReviewSecurityHarnessPlan["checklist"][number]["area"];
  readonly severity?: ReviewSecurityHarnessPlan["checklist"][number]["severity"];
}): ReviewSecurityHarnessPlan["checklist"][number] => ({
  id: over.id,
  area: over.area,
  standard: "internal_quality_standard",
  title: "T",
  description: "D",
  severity: over.severity ?? "info",
  appliesToRole: "reviewer",
  reason: "r",
});

describe("summarizeRecentReviewSecurityPlans", () => {
  it("returns empty when no plans", () => {
    const r = summarizeRecentReviewSecurityPlans({ plans: [] });
    expect(r.sampledEntryCount).toBe(0);
    expect(r.planEntryCount).toBe(0);
    expect(r.totalChecklistItems).toBe(0);
    expect(r.findingRate).toBe(0);
  });

  it("ignores invalid mode but counts sampled entries", () => {
    const r = summarizeRecentReviewSecurityPlans({
      plans: [
        null,
        { mode: "apply" } as unknown as ReviewSecurityHarnessPlan,
        plan({ checklist: [sample({ id: "a", area: "security" })] }),
      ],
    });
    expect(r.sampledEntryCount).toBe(3);
    expect(r.planEntryCount).toBe(1);
    expect(r.totalChecklistItems).toBe(1);
  });

  it("computes security area rate", () => {
    const r = summarizeRecentReviewSecurityPlans({
      plans: [
        plan({
          checklist: [
            sample({ id: "a", area: "security" }),
            sample({ id: "b", area: "requirements" }),
            sample({ id: "c", area: "code_quality" }),
          ],
        }),
      ],
    });
    expect(r.totalChecklistItems).toBe(3);
    expect(r.securityItemRate).toBeCloseTo(1 / 3, 4);
    expect(r.codeQualityItemRate).toBeCloseTo(1 / 3, 4);
  });

  it("computes critical candidate rate", () => {
    const r = summarizeRecentReviewSecurityPlans({
      plans: [
        plan({
          checklist: [
            sample({ id: "a", area: "security", severity: "critical_candidate" }),
            sample({ id: "b", area: "security", severity: "warning" }),
          ],
        }),
      ],
    });
    expect(r.criticalCandidateRate).toBe(0.5);
  });

  it("computes plan-level finding rate", () => {
    const r = summarizeRecentReviewSecurityPlans({
      plans: [
        plan({
          checklist: [sample({ id: "a", area: "security" })],
          findings: [{ code: "F", severity: "info", message: "m" }],
        }),
        plan({ checklist: [sample({ id: "b", area: "security" })], findings: [] }),
      ],
    });
    expect(r.findingRate).toBe(0.5);
  });
});
