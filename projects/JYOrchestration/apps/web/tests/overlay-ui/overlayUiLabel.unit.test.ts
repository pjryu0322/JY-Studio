import { describe, expect, it } from "vitest";

import {
  overlayUiBudgetPolicyLabel,
  overlayUiIncludeModeLabel,
  overlayUiIncludeModeTone,
  overlayUiOverflowRiskLabel,
  overlayUiOverflowRiskTone,
  overlayUiPlanTypeLabel,
  overlayUiPruningCandidateLabel,
  overlayUiWarningSeverityLabel,
  overlayUiWarningSeverityTone,
} from "@/lib/overlay-ui/overlayUiLabel";

describe("overlayUiLabel", () => {
  it("converts overflowRisk into user-facing label and tone", () => {
    expect(overlayUiOverflowRiskLabel("high")).toBe("HIGH");
    expect(overlayUiOverflowRiskLabel("medium")).toBe("MEDIUM");
    expect(overlayUiOverflowRiskLabel("low")).toBe("LOW");
    expect(overlayUiOverflowRiskLabel(null)).toBe("ㅡ");
    expect(overlayUiOverflowRiskTone("high")).toBe("warning");
    expect(overlayUiOverflowRiskTone("low")).toBe("positive");
    expect(overlayUiOverflowRiskTone(undefined)).toBe("neutral");
  });

  it("converts includeMode into Korean label + tone", () => {
    expect(overlayUiIncludeModeLabel("required")).toBe("핵심");
    expect(overlayUiIncludeModeLabel("recommended")).toBe("추천");
    expect(overlayUiIncludeModeLabel("optional")).toBe("선택");
    expect(overlayUiIncludeModeLabel("excludeCandidate")).toBe("축소 후보");
    expect(overlayUiIncludeModeLabel(null)).toBe("선택");
    expect(overlayUiIncludeModeTone("excludeCandidate")).toBe("warning");
    expect(overlayUiIncludeModeTone("required")).toBe("info");
  });

  it("maps plan type and budget policy labels", () => {
    expect(overlayUiPlanTypeLabel("memory")).toBe("기억 컨텍스트");
    expect(overlayUiPlanTypeLabel("knowledge")).toBe("지식 컨텍스트");
    expect(overlayUiPlanTypeLabel("timeline")).toBe("대화 흐름");
    expect(overlayUiPlanTypeLabel(null)).toBe("기타 컨텍스트");
    expect(overlayUiBudgetPolicyLabel("compact")).toBe("압축 정책");
    expect(overlayUiBudgetPolicyLabel("extended")).toBe("확장 정책");
    expect(overlayUiBudgetPolicyLabel(null)).toBe("정책 미정");
  });

  it("maps warning severity to Korean label and tone", () => {
    expect(overlayUiWarningSeverityLabel("critical")).toBe("심각");
    expect(overlayUiWarningSeverityLabel("warning")).toBe("주의");
    expect(overlayUiWarningSeverityLabel("info")).toBe("정보");
    expect(overlayUiWarningSeverityLabel(null)).toBe("정보");
    expect(overlayUiWarningSeverityTone("critical")).toBe("danger");
    expect(overlayUiWarningSeverityTone("warning")).toBe("warning");
    expect(overlayUiWarningSeverityTone("info")).toBe("info");
  });

  it("converts pruning candidate boolean to label", () => {
    expect(overlayUiPruningCandidateLabel(true)).toBe("축소 후보");
    expect(overlayUiPruningCandidateLabel(false)).toBe("유지");
    expect(overlayUiPruningCandidateLabel(null)).toBe("유지");
  });
});
