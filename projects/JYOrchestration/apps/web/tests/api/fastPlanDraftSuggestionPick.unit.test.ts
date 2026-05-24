import { describe, expect, it } from "vitest";
import {
  FAST_PLAN_ACTION_GENERATE_PLAN,
  FAST_PLAN_ACTION_GENERATION_PREP,
} from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";
import { resolveFastPlanDraftSuggestionAction } from "@/lib/requirements/fastPlanDraftSuggestionPick";
import {
  resolveFastPlanArtifactFollowUpAction,
  resolvePlanningArtifactFollowUpAction,
} from "@/lib/requirements/fastPlanDraftGenerationHandoff";

describe("fastPlanDraftSuggestionPick", () => {
  it("routes confirm draft from proposal chip label", () => {
    expect(resolveFastPlanDraftSuggestionAction("초안 확인/확정")).toBe("confirm_draft_slots");
    expect(resolveFastPlanDraftSuggestionAction("이 초안으로 빠른 기획안 생성")).toBe("confirm_draft_slots");
  });

  it("routes plan generation from 기획안 생성 chip", () => {
    expect(resolveFastPlanDraftSuggestionAction(FAST_PLAN_ACTION_GENERATE_PLAN)).toBe("generate_artifact");
  });

  it("routes plan view and generation prep follow-up chips", () => {
    expect(resolveFastPlanArtifactFollowUpAction("기획안 보기")).toBe("view_artifact");
    expect(resolveFastPlanArtifactFollowUpAction(FAST_PLAN_ACTION_GENERATION_PREP)).toBe(
      "check_generation_readiness",
    );
    expect(resolveFastPlanArtifactFollowUpAction("기획 보완 계속하기")).toBe("continue_planning");
    expect(resolvePlanningArtifactFollowUpAction("생성 단계로 이동")).toBe("check_generation_readiness");
  });
});
