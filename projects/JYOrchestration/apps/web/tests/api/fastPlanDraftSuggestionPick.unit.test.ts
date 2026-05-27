import { describe, expect, it } from "vitest";
import {
  FAST_PLAN_ACTION_GENERATE_PLAN,
  FAST_PLAN_ACTION_GENERATION_PREP,
  FAST_PLAN_ACTION_GO_IMPLEMENTATION_STAGE,
  FAST_PLAN_ACTION_START_IMPLEMENTATION,
  FAST_PLAN_ACTION_VIEW_ARTIFACTS,
  FAST_PLAN_DRAFT_ACTION_CONFIRM,
} from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";
import { resolveFastPlanDraftSuggestionAction } from "@/lib/requirements/fastPlanDraftSuggestionPick";
import {
  resolveFastPlanArtifactFollowUpAction,
  resolvePlanningArtifactFollowUpAction,
} from "@/lib/requirements/fastPlanDraftGenerationHandoff";

describe("fastPlanDraftSuggestionPick", () => {
  it("routes confirm draft from proposal chip label", () => {
    expect(resolveFastPlanDraftSuggestionAction(FAST_PLAN_DRAFT_ACTION_CONFIRM)).toBe("confirm_draft_slots");
    expect(resolveFastPlanDraftSuggestionAction("초안 확인/확정")).toBe("confirm_draft_slots");
    expect(resolveFastPlanDraftSuggestionAction("이 초안으로 빠른 기획안 생성")).toBe("confirm_draft_slots");
  });

  it("routes legacy plan generation chip to artifact view", () => {
    expect(resolveFastPlanDraftSuggestionAction(FAST_PLAN_ACTION_GENERATE_PLAN)).toBe("view_artifacts");
  });

  it("routes implementation follow-up chips", () => {
    expect(resolveFastPlanArtifactFollowUpAction(FAST_PLAN_ACTION_VIEW_ARTIFACTS)).toBe("view_artifacts");
    expect(resolveFastPlanArtifactFollowUpAction("기획안 보기")).toBe("view_artifacts");
    expect(resolveFastPlanArtifactFollowUpAction(FAST_PLAN_ACTION_START_IMPLEMENTATION)).toBe("start_implementation");
    expect(resolveFastPlanArtifactFollowUpAction(FAST_PLAN_ACTION_GO_IMPLEMENTATION_STAGE)).toBe(
      "start_implementation",
    );
    expect(resolveFastPlanDraftSuggestionAction(FAST_PLAN_ACTION_GO_IMPLEMENTATION_STAGE)).toBe(
      "start_implementation",
    );
    expect(resolveFastPlanArtifactFollowUpAction(FAST_PLAN_ACTION_GENERATION_PREP)).toBe("start_implementation");
    expect(resolveFastPlanArtifactFollowUpAction("기획 보완 계속하기")).toBe("refine");
    expect(resolvePlanningArtifactFollowUpAction("생성 단계로 이동")).toBe("start_implementation");
  });
});
