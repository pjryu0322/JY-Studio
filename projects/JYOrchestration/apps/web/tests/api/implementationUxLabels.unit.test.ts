import { describe, expect, it } from "vitest";
import {
  FAST_PLAN_DRAFT_ACTION_CONFIRM,
  FAST_PLAN_DRAFT_NEXT_ACTION_LABELS,
  PLANNING_ARTIFACT_FOLLOW_UP_LABELS,
} from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";
import { IMPLEMENTATION_PHASE_LABEL, QUICK_DESIGN_CONFIRM_ACTION_LABEL } from "@/lib/requirements/implementationUxLabels";

describe("implementationUxLabels", () => {
  it("replaces draft confirm wording with Quick Design confirm", () => {
    expect(FAST_PLAN_DRAFT_ACTION_CONFIRM).toBe(QUICK_DESIGN_CONFIRM_ACTION_LABEL);
    expect(FAST_PLAN_DRAFT_ACTION_CONFIRM).toBe("Quick Design 확정");
    expect(FAST_PLAN_DRAFT_ACTION_CONFIRM).not.toBe("초안 확인/확정");
    expect(FAST_PLAN_DRAFT_NEXT_ACTION_LABELS).toContain("Quick Design 확정");
    expect(FAST_PLAN_DRAFT_NEXT_ACTION_LABELS).not.toContain("초안 확인/확정");
  });

  it("removes plan generation and generation prep from user-facing chips", () => {
    expect(FAST_PLAN_DRAFT_NEXT_ACTION_LABELS).not.toContain("기획안 생성");
    expect(PLANNING_ARTIFACT_FOLLOW_UP_LABELS).not.toContain("기획안 생성");
    expect(PLANNING_ARTIFACT_FOLLOW_UP_LABELS).not.toContain("생성 단계 준비");
    expect(PLANNING_ARTIFACT_FOLLOW_UP_LABELS).toEqual(
      expect.arrayContaining(["Artifact 보기", "구현 시작", "추가 보완"]),
    );
  });

  it("uses implementation phase wording", () => {
    expect(IMPLEMENTATION_PHASE_LABEL).toBe("구현 단계");
  });
});
