import { describe, expect, it } from "vitest";

import {
  buildRemediationLoopPlanVM,
  buildReviewSecurityIssuePlanVM,
  buildReviewSecurityIssueRecentTrendVM,
  REMEDIATION_LOOP_DISCLAIMER,
  REVIEW_SECURITY_ISSUE_PLAN_DISCLAIMER,
  remediationLoopStepTypeLabel,
  reviewSecurityIssueStatusLabel,
  reviewSecurityRemediationActionLabel,
} from "@/lib/overlay-ui/reviewSecurityIssueUiAdapter";

describe("reviewSecurityIssueUiAdapter labels", () => {
  it("returns Korean labels for issue status", () => {
    expect(reviewSecurityIssueStatusLabel("candidate")).toBe("후보");
    expect(reviewSecurityIssueStatusLabel("needs_review")).toBe("재검토 권장");
    expect(reviewSecurityIssueStatusLabel("needs_remediation")).toBe("조치 권장");
  });

  it("returns Korean labels for recommended actions", () => {
    expect(reviewSecurityRemediationActionLabel("security_recheck")).toBe("AI보안관 재점검");
    expect(reviewSecurityRemediationActionLabel("developer_fix")).toBe("AI개발자 조치");
  });

  it("returns Korean labels for loop step types", () => {
    expect(remediationLoopStepTypeLabel("review")).toBe("검토");
    expect(remediationLoopStepTypeLabel("final_review")).toBe("최종 검토");
  });
});

describe("buildReviewSecurityIssuePlanVM", () => {
  it("returns empty state for null input", () => {
    const vm = buildReviewSecurityIssuePlanVM(null);
    expect(vm.hasData).toBe(false);
    expect(vm.disclaimer).toBe(REVIEW_SECURITY_ISSUE_PLAN_DISCLAIMER);
    expect(vm.issues).toEqual([]);
  });

  it("rejects wrong mode and falls back to empty state", () => {
    const vm = buildReviewSecurityIssuePlanVM({
      mode: "real_enforcement",
      issues: [],
      findings: [],
    } as never);
    expect(vm.hasData).toBe(false);
  });

  it("counts critical/security/needs_remediation/needs_recheck", () => {
    const vm = buildReviewSecurityIssuePlanVM({
      mode: "dry_run_issue_planning",
      issues: [
        {
          id: "a",
          sourceChecklistId: "s",
          area: "security",
          standard: "owasp_top10",
          severity: "critical_candidate",
          status: "needs_review",
          title: "t1",
          description: "d1",
          remediationHint: "h",
          recommendedAction: "security_recheck",
          duplicateGroupKey: "security:owasp_top10",
        },
        {
          id: "b",
          sourceChecklistId: "s",
          area: "code_quality",
          standard: "internal_quality_standard",
          severity: "info",
          status: "needs_remediation",
          title: "t2",
          description: "d2",
          remediationHint: "h",
          recommendedAction: "developer_fix",
          duplicateGroupKey: "code_quality:internal_quality_standard",
        },
      ],
      findings: [],
    });
    expect(vm.hasData).toBe(true);
    expect(vm.issues.length).toBe(2);
    expect(vm.duplicateGroups.length).toBe(2);
    expect(vm.totalLabel).toContain("2");
    expect(vm.criticalCandidatesLabel).toContain("1");
    expect(vm.securityIssuesLabel).toContain("1");
    expect(vm.needsRemediationLabel).toContain("1");
  });
});

describe("buildRemediationLoopPlanVM", () => {
  it("returns empty state for null input", () => {
    const vm = buildRemediationLoopPlanVM(null);
    expect(vm.hasData).toBe(false);
    expect(vm.disclaimer).toBe(REMEDIATION_LOOP_DISCLAIMER);
  });

  it("returns step VMs with labels", () => {
    const vm = buildRemediationLoopPlanVM({
      mode: "dry_run_remediation_loop",
      steps: [
        { order: 1, type: "review", actorRole: "reviewer", description: "r" },
        { order: 2, type: "final_review", actorRole: "user", description: "f" },
      ],
      findings: [],
    });
    expect(vm.steps.length).toBe(2);
    expect(vm.steps[0]?.typeLabel).toBe("검토");
    expect(vm.steps[1]?.typeLabel).toBe("최종 검토");
  });
});

describe("buildReviewSecurityIssueRecentTrendVM", () => {
  it("returns hasData=false for empty summary", () => {
    const vm = buildReviewSecurityIssueRecentTrendVM(null);
    expect(vm.hasData).toBe(false);
    expect(vm.totalLabel).toContain("0");
  });

  it("formats percentage labels correctly", () => {
    const vm = buildReviewSecurityIssueRecentTrendVM({
      sampledEntryCount: 10,
      reportEntryCount: 8,
      totalIssues: 4,
      securityIssueRate: 0.25,
      criticalCandidateRate: 0.5,
      needsRemediationRate: 0.75,
      findingRate: 1,
    });
    expect(vm.hasData).toBe(true);
    expect(vm.securityRateLabel).toContain("25%");
    expect(vm.criticalCandidateRateLabel).toContain("50%");
    expect(vm.needsRemediationRateLabel).toContain("75%");
    expect(vm.findingRateLabel).toContain("100%");
  });
});
