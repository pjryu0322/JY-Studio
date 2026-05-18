import { describe, expect, it } from "vitest";

import { buildRemediationLoopPlan } from "@/lib/harness/reviewSecurity/buildRemediationLoopPlan";
import type {
  ReviewSecurityIssueCandidate,
  ReviewSecurityIssuePlanningReport,
} from "@/lib/harness/reviewSecurity/reviewSecurityIssueTypes";

function mkIssue(
  overrides: Partial<ReviewSecurityIssueCandidate> = {}
): ReviewSecurityIssueCandidate {
  return {
    id: "checklist:reviewer_quality_test",
    sourceChecklistId: "code_quality:internal_quality_standard:test_coverage",
    area: "code_quality",
    standard: "internal_quality_standard",
    severity: "warning",
    status: "needs_review",
    title: "test coverage",
    description: "테스트 보강 후보",
    remediationHint: "AI개발자가 테스트 추가 여부를 검토합니다.",
    recommendedAction: "developer_fix",
    duplicateGroupKey: "code_quality:internal_quality_standard",
    ...overrides,
  };
}

function mkReport(
  issues: ReviewSecurityIssueCandidate[]
): ReviewSecurityIssuePlanningReport {
  return {
    mode: "dry_run_issue_planning",
    issues,
    findings: [],
  };
}

describe("buildRemediationLoopPlan", () => {
  it("returns dry_run mode plan with empty/minimal loop when no issues", () => {
    const plan = buildRemediationLoopPlan({});
    expect(plan.mode).toBe("dry_run_remediation_loop");
    expect(plan.steps).toEqual([]);
    expect(plan.findings.some((f) => f.code === "REMEDIATION_LOOP_DRY_RUN_ONLY")).toBe(true);
  });

  it("returns empty loop when report has no issues", () => {
    const plan = buildRemediationLoopPlan({ issuePlanningReport: mkReport([]) });
    expect(plan.steps).toEqual([]);
  });

  it("builds review/assign/fix/recheck/final_review steps when issues exist", () => {
    const plan = buildRemediationLoopPlan({
      issuePlanningReport: mkReport([mkIssue()]),
    });
    const types = plan.steps.map((s) => s.type);
    expect(types).toEqual(["review", "assign", "fix", "recheck", "final_review"]);
  });

  it("maps developer_fix issue to developer actor in assign step", () => {
    const plan = buildRemediationLoopPlan({
      issuePlanningReport: mkReport([mkIssue({ recommendedAction: "developer_fix" })]),
    });
    const assign = plan.steps.find((s) => s.type === "assign");
    expect(assign?.actorRole).toContain("developer");
  });

  it("escalates to reviewer+security on security area", () => {
    const plan = buildRemediationLoopPlan({
      issuePlanningReport: mkReport([
        mkIssue({ area: "security", recommendedAction: "security_recheck" }),
      ]),
    });
    const review = plan.steps.find((s) => s.type === "review");
    expect(review?.actorRole).toBe("reviewer+security");
    const recheck = plan.steps.find((s) => s.type === "recheck");
    expect(recheck?.actorRole).toBe("security");
  });

  it("includes USER_DECISION_REQUIRED finding when user decision needed", () => {
    const plan = buildRemediationLoopPlan({
      issuePlanningReport: mkReport([
        mkIssue({ recommendedAction: "user_decision_required" }),
      ]),
    });
    expect(plan.findings.some((f) => f.code === "USER_DECISION_REQUIRED")).toBe(true);
  });

  it("always emits REMEDIATION_LOOP_DRY_RUN_ONLY finding when steps exist", () => {
    const plan = buildRemediationLoopPlan({
      issuePlanningReport: mkReport([mkIssue()]),
    });
    expect(
      plan.findings.some((f) => f.code === "REMEDIATION_LOOP_DRY_RUN_ONLY")
    ).toBe(true);
  });

  it("produces deterministic step order for repeated calls", () => {
    const report = mkReport([mkIssue(), mkIssue({ id: "checklist:security_a", area: "security", recommendedAction: "security_recheck" })]);
    const a = buildRemediationLoopPlan({ issuePlanningReport: report });
    const b = buildRemediationLoopPlan({ issuePlanningReport: report });
    expect(a.steps.map((s) => s.type)).toEqual(b.steps.map((s) => s.type));
  });
});
