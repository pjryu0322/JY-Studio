import { describe, expect, it } from "vitest";

import {
  coerceReviewSecurityIssuePlanningMetadata,
  parseRemediationLoopPlanFromUnknown,
  parseReviewSecurityIssuePlanningReportFromUnknown,
} from "@/lib/harness/reviewSecurity/reviewSecurityIssueCoerce";

describe("parseReviewSecurityIssuePlanningReportFromUnknown", () => {
  it("returns null for non-object input", () => {
    expect(parseReviewSecurityIssuePlanningReportFromUnknown(null)).toBeNull();
    expect(parseReviewSecurityIssuePlanningReportFromUnknown(undefined)).toBeNull();
    expect(parseReviewSecurityIssuePlanningReportFromUnknown(123)).toBeNull();
    expect(parseReviewSecurityIssuePlanningReportFromUnknown("x")).toBeNull();
    expect(parseReviewSecurityIssuePlanningReportFromUnknown([])).toBeNull();
  });

  it("rejects wrong mode", () => {
    const got = parseReviewSecurityIssuePlanningReportFromUnknown({
      mode: "real_enforcement",
      issues: [],
      findings: [],
    });
    expect(got).toBeNull();
  });

  it("parses valid report and preserves fields", () => {
    const raw = {
      mode: "dry_run_issue_planning",
      issues: [
        {
          id: "checklist:abc",
          sourceChecklistId: "src:abc",
          area: "security",
          standard: "owasp_top10",
          severity: "warning",
          status: "needs_review",
          title: "title",
          description: "desc",
          remediationHint: "hint",
          recommendedAction: "security_recheck",
          duplicateGroupKey: "security:owasp_top10",
        },
      ],
      findings: [
        { code: "ISSUE_PLAN_DRY_RUN_ONLY", severity: "info", message: "ok" },
      ],
    };
    const got = parseReviewSecurityIssuePlanningReportFromUnknown(raw);
    expect(got?.mode).toBe("dry_run_issue_planning");
    expect(got?.issues.length).toBe(1);
    expect(got?.issues[0]?.area).toBe("security");
    expect(got?.findings.length).toBe(1);
  });

  it("falls back invalid severity/status/action to safe defaults", () => {
    const raw = {
      mode: "dry_run_issue_planning",
      issues: [
        {
          id: "x",
          sourceChecklistId: "y",
          area: "code_quality",
          standard: "internal_quality_standard",
          severity: "totally-invalid",
          status: "weird",
          title: "t",
          description: "d",
          recommendedAction: "nope",
          duplicateGroupKey: "",
        },
      ],
      findings: [],
    };
    const got = parseReviewSecurityIssuePlanningReportFromUnknown(raw);
    expect(got?.issues[0]?.severity).toBe("info");
    expect(got?.issues[0]?.status).toBe("candidate");
    expect(got?.issues[0]?.recommendedAction).toBe("reviewer_recheck");
    expect(got?.issues[0]?.duplicateGroupKey).toBe("code_quality:internal_quality_standard");
  });

  it("drops items with invalid area/standard or missing required strings", () => {
    const raw = {
      mode: "dry_run_issue_planning",
      issues: [
        {
          id: "ok",
          sourceChecklistId: "src",
          area: "not_a_real_area",
          standard: "owasp_top10",
          severity: "info",
          status: "candidate",
          title: "t",
          description: "d",
          remediationHint: "h",
          recommendedAction: "developer_fix",
          duplicateGroupKey: "k",
        },
        {
          id: "",
          sourceChecklistId: "src",
          area: "security",
          standard: "owasp_top10",
          severity: "info",
          status: "candidate",
          title: "t",
          description: "d",
          remediationHint: "h",
          recommendedAction: "developer_fix",
          duplicateGroupKey: "k",
        },
      ],
      findings: [],
    };
    const got = parseReviewSecurityIssuePlanningReportFromUnknown(raw);
    expect(got?.issues.length).toBe(0);
  });

  it("dedupes issues with the same id", () => {
    const raw = {
      mode: "dry_run_issue_planning",
      issues: Array.from({ length: 3 }).map(() => ({
        id: "same",
        sourceChecklistId: "src",
        area: "code_quality",
        standard: "internal_quality_standard",
        severity: "info",
        status: "candidate",
        title: "t",
        description: "d",
        remediationHint: "h",
        recommendedAction: "developer_fix",
        duplicateGroupKey: "k",
      })),
      findings: [],
    };
    const got = parseReviewSecurityIssuePlanningReportFromUnknown(raw);
    expect(got?.issues.length).toBe(1);
  });
});

describe("parseRemediationLoopPlanFromUnknown", () => {
  it("returns null for wrong mode", () => {
    expect(
      parseRemediationLoopPlanFromUnknown({ mode: "x", steps: [] })
    ).toBeNull();
  });

  it("parses valid steps and coerces order", () => {
    const got = parseRemediationLoopPlanFromUnknown({
      mode: "dry_run_remediation_loop",
      steps: [
        { order: -1, type: "review", actorRole: "reviewer", description: "review" },
        { order: 2.7, type: "assign", actorRole: "developer", description: "assign" },
        { order: "no", type: "not_a_step", actorRole: "", description: "dropme" },
      ],
      findings: [],
    });
    expect(got?.steps.length).toBe(2);
    expect(got?.steps[0]?.order).toBe(0);
    expect(got?.steps[1]?.order).toBe(2);
  });
});

describe("coerceReviewSecurityIssuePlanningMetadata", () => {
  it("returns empty object for falsy input", () => {
    expect(coerceReviewSecurityIssuePlanningMetadata(null)).toEqual({});
    expect(coerceReviewSecurityIssuePlanningMetadata(undefined)).toEqual({});
  });

  it("picks only matching fields out of a timeline row", () => {
    const row = {
      reviewSecurityIssuePlanningReport: {
        mode: "dry_run_issue_planning",
        issues: [],
        findings: [],
      },
      remediationLoopPlan: {
        mode: "dry_run_remediation_loop",
        steps: [],
        findings: [],
      },
      unrelated: 1,
    };
    const got = coerceReviewSecurityIssuePlanningMetadata(row);
    expect(got.reviewSecurityIssuePlanningReport?.mode).toBe("dry_run_issue_planning");
    expect(got.remediationLoopPlan?.mode).toBe("dry_run_remediation_loop");
  });
});
