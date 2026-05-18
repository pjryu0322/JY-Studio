import { describe, expect, it } from "vitest";

import {
  OVERLAY_UI_BUDGET_DISCLAIMER,
  OVERLAY_UI_EMPTY_STATE_HINT,
  OVERLAY_UI_EMPTY_STATE_MESSAGE,
  OVERLAY_UI_PLANNING_DISCLAIMER,
  OVERLAY_UI_WARNING_DISCLAIMER,
  overlayUiConflictWarningDescription,
  overlayUiIncludeModeDescription,
  overlayUiOverflowRiskDescription,
  overlayUiPolicyDriftDescription,
  overlayUiPruningSuggestionDescription,
} from "@/lib/overlay-ui/overlayUiDescription";

describe("overlayUiDescription", () => {
  it("provides distinct Korean sentences for each overflow risk level", () => {
    expect(overlayUiOverflowRiskDescription("low")).toMatch(/안정/);
    expect(overlayUiOverflowRiskDescription("medium")).toMatch(/길어지/);
    expect(overlayUiOverflowRiskDescription("high")).toMatch(/축약/);
    expect(overlayUiOverflowRiskDescription("high")).toContain("가능성");
    expect(overlayUiOverflowRiskDescription(null)).toMatch(/기록되지/);
  });

  it("explains includeMode in user-friendly wording", () => {
    expect(overlayUiIncludeModeDescription("required")).toContain("핵심");
    expect(overlayUiIncludeModeDescription("recommended")).toContain("추천");
    expect(overlayUiIncludeModeDescription("optional")).toContain("선택");
    expect(overlayUiIncludeModeDescription("excludeCandidate")).toContain("축소");
    expect(overlayUiIncludeModeDescription("excludeCandidate")).toContain("실제 제거 아님");
  });

  it("counts warnings (conflict / drift) into Korean phrases", () => {
    expect(overlayUiConflictWarningDescription(0)).toMatch(/없습니다/);
    expect(overlayUiConflictWarningDescription(2)).toMatch(/2건/);
    expect(overlayUiConflictWarningDescription(2)).toContain("참고용");
    expect(overlayUiPolicyDriftDescription(0)).toMatch(/감지되지 않/);
    expect(overlayUiPolicyDriftDescription(3)).toMatch(/3건/);
  });

  it("describes pruning suggestion count", () => {
    expect(overlayUiPruningSuggestionDescription(0)).toMatch(/없습니다/);
    expect(overlayUiPruningSuggestionDescription(2)).toContain("2건");
    expect(overlayUiPruningSuggestionDescription(2)).toContain("실제 제거는 수행되지 않");
  });

  it("exposes disclaimer / empty state constants for UI reuse", () => {
    expect(OVERLAY_UI_PLANNING_DISCLAIMER).toContain("계획 정보");
    expect(OVERLAY_UI_BUDGET_DISCLAIMER).toContain("휴리스틱");
    expect(OVERLAY_UI_WARNING_DISCLAIMER).toContain("차단하지 않");
    expect(OVERLAY_UI_EMPTY_STATE_MESSAGE).toContain("기록되지");
    expect(OVERLAY_UI_EMPTY_STATE_HINT).toContain("최근 AI 응답부터");
  });
});
