import { describe, expect, it } from "vitest";

import {
  coerceReviewSecurityHarnessMetadata,
  parseReviewSecurityHarnessPlanFromUnknown,
} from "@/lib/harness/reviewSecurity/reviewSecurityHarnessCoerce";

const validRow = {
  mode: "dry_run_review_security",
  roleKey: "reviewer",
  workspaceStage: "analyze",
  checklist: [
    {
      id: "code_quality:internal_quality_standard:test_coverage",
      area: "code_quality",
      standard: "internal_quality_standard",
      title: "테스트/품질 기준 점검",
      description: "단위 테스트·경계 케이스가 검증되었는지 확인합니다.",
      severity: "warning",
      appliesToRole: "reviewer",
      reason: "reviewer_default_quality_baseline",
    },
  ],
  findings: [
    { code: "REVIEW_PLAN_DRY_RUN_ONLY", severity: "info", message: "계획 메타데이터입니다." },
  ],
};

describe("parseReviewSecurityHarnessPlanFromUnknown", () => {
  it("rejects null / non-object / wrong mode", () => {
    expect(parseReviewSecurityHarnessPlanFromUnknown(null)).toBeNull();
    expect(parseReviewSecurityHarnessPlanFromUnknown("nope")).toBeNull();
    expect(parseReviewSecurityHarnessPlanFromUnknown({ ...validRow, mode: "apply" })).toBeNull();
  });

  it("parses a valid plan", () => {
    const parsed = parseReviewSecurityHarnessPlanFromUnknown(validRow);
    expect(parsed).not.toBeNull();
    expect(parsed?.mode).toBe("dry_run_review_security");
    expect(parsed?.roleKey).toBe("reviewer");
    expect(parsed?.workspaceStage).toBe("analyze");
    expect(parsed?.checklist.length).toBe(1);
    expect(parsed?.checklist[0]?.id).toBe(
      "code_quality:internal_quality_standard:test_coverage"
    );
    expect(parsed?.findings.length).toBe(1);
  });

  it("drops checklist items missing required fields", () => {
    const row = {
      ...validRow,
      checklist: [
        { ...validRow.checklist[0], id: "" },
        { ...validRow.checklist[0], area: "invalid_area" },
        { ...validRow.checklist[0], standard: "fake_standard" },
        { ...validRow.checklist[0], title: "" },
        { ...validRow.checklist[0], description: "" },
        validRow.checklist[0],
      ],
    };
    const parsed = parseReviewSecurityHarnessPlanFromUnknown(row);
    expect(parsed?.checklist.length).toBe(1);
  });

  it("falls back severity to info when invalid", () => {
    const row = {
      ...validRow,
      checklist: [
        { ...validRow.checklist[0], severity: "screaming" },
      ],
    };
    const parsed = parseReviewSecurityHarnessPlanFromUnknown(row);
    expect(parsed?.checklist[0]?.severity).toBe("info");
  });

  it("drops duplicate ids", () => {
    const row = {
      ...validRow,
      checklist: [
        validRow.checklist[0],
        { ...validRow.checklist[0], title: "dup" },
      ],
    };
    const parsed = parseReviewSecurityHarnessPlanFromUnknown(row);
    expect(parsed?.checklist.length).toBe(1);
  });

  it("drops findings with invalid severity", () => {
    const row = {
      ...validRow,
      findings: [
        { code: "X", severity: "screaming", message: "drop me" },
        { code: "Y", severity: "info", message: "keep me" },
      ],
    };
    const parsed = parseReviewSecurityHarnessPlanFromUnknown(row);
    expect(parsed?.findings.length).toBe(1);
    expect(parsed?.findings[0]?.code).toBe("Y");
  });
});

describe("coerceReviewSecurityHarnessMetadata", () => {
  it("returns plan when valid", () => {
    const out = coerceReviewSecurityHarnessMetadata({ reviewSecurityHarnessPlan: validRow });
    expect(out.reviewSecurityHarnessPlan?.mode).toBe("dry_run_review_security");
  });

  it("returns empty when missing or invalid", () => {
    expect(coerceReviewSecurityHarnessMetadata(null)).toEqual({});
    expect(coerceReviewSecurityHarnessMetadata({})).toEqual({});
    expect(
      coerceReviewSecurityHarnessMetadata({ reviewSecurityHarnessPlan: { mode: "apply" } })
    ).toEqual({});
  });
});
