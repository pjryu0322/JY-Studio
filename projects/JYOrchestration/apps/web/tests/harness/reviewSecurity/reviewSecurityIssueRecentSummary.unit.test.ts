import { describe, expect, it } from "vitest";

import { summarizeRecentReviewSecurityIssuePlans } from "@/lib/harness/reviewSecurity/reviewSecurityIssueRecentSummary";
import type { ReviewSecurityIssuePlanningReport } from "@/lib/harness/reviewSecurity/reviewSecurityIssueTypes";

function mkReport(overrides: Partial<ReviewSecurityIssuePlanningReport> = {}): ReviewSecurityIssuePlanningReport {
  return {
    mode: "dry_run_issue_planning",
    issues: [],
    findings: [],
    ...overrides,
  };
}

describe("summarizeRecentReviewSecurityIssuePlans", () => {
  it("returns empty summary for empty input", () => {
    const got = summarizeRecentReviewSecurityIssuePlans({ reports: [] });
    expect(got.sampledEntryCount).toBe(0);
    expect(got.reportEntryCount).toBe(0);
    expect(got.totalIssues).toBe(0);
    expect(got.findingRate).toBe(0);
  });

  it("ignores invalid reports but counts in sampledEntryCount", () => {
    const got = summarizeRecentReviewSecurityIssuePlans({
      reports: [null, undefined, mkReport(), { mode: "wrong" } as unknown as ReviewSecurityIssuePlanningReport],
    });
    expect(got.sampledEntryCount).toBe(4);
    expect(got.reportEntryCount).toBe(1);
  });

  it("computes security issue rate", () => {
    const reports: ReviewSecurityIssuePlanningReport[] = [
      mkReport({
        issues: [
          {
            id: "a",
            sourceChecklistId: "s",
            area: "security",
            standard: "owasp_top10",
            severity: "warning",
            status: "needs_review",
            title: "t",
            description: "d",
            remediationHint: "h",
            recommendedAction: "security_recheck",
            duplicateGroupKey: "k",
          },
          {
            id: "b",
            sourceChecklistId: "s",
            area: "code_quality",
            standard: "internal_quality_standard",
            severity: "info",
            status: "candidate",
            title: "t",
            description: "d",
            remediationHint: "h",
            recommendedAction: "developer_fix",
            duplicateGroupKey: "k",
          },
        ],
      }),
    ];
    const got = summarizeRecentReviewSecurityIssuePlans({ reports });
    expect(got.totalIssues).toBe(2);
    expect(got.securityIssueRate).toBe(0.5);
  });

  it("computes critical_candidate and needs_remediation rates", () => {
    const issuesCritical = {
      id: "c1",
      sourceChecklistId: "s",
      area: "security" as const,
      standard: "owasp_top10" as const,
      severity: "critical_candidate" as const,
      status: "needs_remediation" as const,
      title: "t",
      description: "d",
      remediationHint: "h",
      recommendedAction: "security_recheck" as const,
      duplicateGroupKey: "k",
    };
    const issueOther = {
      id: "c2",
      sourceChecklistId: "s",
      area: "code_quality" as const,
      standard: "internal_quality_standard" as const,
      severity: "info" as const,
      status: "candidate" as const,
      title: "t",
      description: "d",
      remediationHint: "h",
      recommendedAction: "developer_fix" as const,
      duplicateGroupKey: "k",
    };
    const got = summarizeRecentReviewSecurityIssuePlans({
      reports: [mkReport({ issues: [issuesCritical, issueOther] })],
    });
    expect(got.criticalCandidateRate).toBe(0.5);
    expect(got.needsRemediationRate).toBe(0.5);
  });

  it("computes finding rate over valid reports", () => {
    const reports: ReviewSecurityIssuePlanningReport[] = [
      mkReport({
        findings: [{ code: "X", severity: "info", message: "m" }],
      }),
      mkReport({}),
      mkReport({}),
    ];
    const got = summarizeRecentReviewSecurityIssuePlans({ reports });
    expect(got.reportEntryCount).toBe(3);
    expect(got.findingRate).toBeCloseTo(1 / 3, 4);
  });
});
