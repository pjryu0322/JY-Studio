import { describe, expect, it } from "vitest";

import {
  buildReviewSecurityPlanVM,
  buildReviewSecurityRecentTrendVM,
  reviewSecurityAreaLabel,
  reviewSecurityFindingSeverityLabel,
  reviewSecurityReasonLabel,
  reviewSecuritySeverityLabel,
  REVIEW_SECURITY_PLAN_DISCLAIMER,
} from "@/lib/overlay-ui/reviewSecurityUiAdapter";
import type { ReviewSecurityHarnessPlan } from "@/lib/harness/reviewSecurity/reviewSecurityHarnessTypes";
import { OVERLAY_UI_MISSING_LABEL } from "@/lib/overlay-ui/overlayUiFormat";

function mkPlan(over?: Partial<ReviewSecurityHarnessPlan>): ReviewSecurityHarnessPlan {
  return {
    mode: "dry_run_review_security",
    roleKey: "reviewer",
    workspaceStage: "analyze",
    checklist: [
      {
        id: "security:owasp_top10:input_validation",
        area: "security",
        standard: "owasp_top10",
        title: "입력 검증",
        description: "OWASP",
        severity: "critical_candidate",
        appliesToRole: "security",
        reason: "security_default_owasp_top10",
      },
      {
        id: "requirements:internal_quality_standard:coverage",
        area: "requirements",
        standard: "internal_quality_standard",
        title: "요구사항",
        description: "내용",
        severity: "warning",
        appliesToRole: "reviewer",
        reason: "reviewer_default_requirements_coverage",
      },
    ],
    findings: [
      {
        code: "REVIEW_PLAN_DRY_RUN_ONLY",
        severity: "info",
        message: "계획 정보입니다.",
      },
    ],
    ...(over ?? {}),
  } as ReviewSecurityHarnessPlan;
}

describe("buildReviewSecurityPlanVM", () => {
  it("returns hasData=false fallback when plan is null", () => {
    const vm = buildReviewSecurityPlanVM(null);
    expect(vm.hasData).toBe(false);
    expect(vm.disclaimer).toBe(REVIEW_SECURITY_PLAN_DISCLAIMER);
    expect(vm.roleValue).toBe(OVERLAY_UI_MISSING_LABEL);
    expect(vm.totalLabel).toBe("후보 0개");
    expect(vm.items.length).toBe(0);
  });

  it("returns hasData=false when mode is wrong", () => {
    const vm = buildReviewSecurityPlanVM({ mode: "apply" } as unknown as ReviewSecurityHarnessPlan);
    expect(vm.hasData).toBe(false);
  });

  it("transforms checklist items with labels and tones", () => {
    const vm = buildReviewSecurityPlanVM(mkPlan());
    expect(vm.hasData).toBe(true);
    expect(vm.items[0]?.areaLabel).toBe("보안");
    expect(vm.items[0]?.severityLabel).toBe("중요 후보");
    expect(vm.items[0]?.severityTone).toBe("danger");
    expect(vm.items[0]?.standardLabel).toBe("OWASP Top 10");
    expect(vm.items[0]?.reasonLabel).toBe("OWASP Top 10 기본 점검");
    expect(vm.items[1]?.areaLabel).toBe("요구사항");
    expect(vm.items[1]?.reasonLabel).toBe("검수자 기본 요구사항 충족도");
  });

  it("builds areaBreakdown sorted by label", () => {
    const vm = buildReviewSecurityPlanVM(mkPlan());
    expect(vm.areaBreakdown.length).toBe(2);
    expect(vm.areaBreakdown[0]?.areaLabel).toBe("보안");
    expect(vm.areaBreakdown[1]?.areaLabel).toBe("요구사항");
  });

  it("collects sorted unique standard labels", () => {
    const vm = buildReviewSecurityPlanVM(mkPlan());
    expect(vm.standardLabels).toEqual(["OWASP Top 10", "내부 품질 표준"]);
  });

  it("emits critical candidates label even when summary is missing", () => {
    const vm = buildReviewSecurityPlanVM(mkPlan());
    expect(vm.criticalCandidatesLabel).toBe("중요 후보 1");
  });
});

describe("buildReviewSecurityRecentTrendVM", () => {
  it("returns hasData=false for null/empty input", () => {
    const vm = buildReviewSecurityRecentTrendVM(null);
    expect(vm.hasData).toBe(false);
    expect(vm.securityRateLabel).toBe("보안 영역 비율 0%");
  });

  it("formats rates as integer percentage", () => {
    const vm = buildReviewSecurityRecentTrendVM({
      sampledEntryCount: 5,
      planEntryCount: 4,
      totalChecklistItems: 10,
      securityItemRate: 0.3,
      codeQualityItemRate: 0.2,
      criticalCandidateRate: 0.1,
      findingRate: 0.5,
    });
    expect(vm.hasData).toBe(true);
    expect(vm.securityRateLabel).toBe("보안 영역 비율 30%");
    expect(vm.criticalCandidateRateLabel).toBe("중요 후보 비율 10%");
    expect(vm.findingRateLabel).toBe("진단 발생 plan 50%");
  });
});

describe("label helpers", () => {
  it("areaLabel maps known areas", () => {
    expect(reviewSecurityAreaLabel("uiux")).toBe("UI/UX");
    expect(reviewSecurityAreaLabel("operations")).toBe("운영");
  });

  it("severityLabel maps to Korean labels", () => {
    expect(reviewSecuritySeverityLabel("warning")).toBe("주의");
    expect(reviewSecuritySeverityLabel("critical_candidate")).toBe("중요 후보");
  });

  it("findingSeverityLabel maps both severities", () => {
    expect(reviewSecurityFindingSeverityLabel("info")).toBe("안내");
    expect(reviewSecurityFindingSeverityLabel("warning")).toBe("주의");
  });

  it("reasonLabel falls back to raw input for unknown keys", () => {
    expect(reviewSecurityReasonLabel("totally_new_key")).toBe("totally_new_key");
    expect(reviewSecurityReasonLabel("")).toBe("사유 미지정");
  });
});
