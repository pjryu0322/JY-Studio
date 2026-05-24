import { describe, expect, it } from "vitest";
import { FAST_PLAN_DRAFT_ACTION_GENERATE } from "@/lib/platform-orchestration/adapters/fastPlanDraftActions";
import { resolveFastPlanDraftSuggestionAction } from "@/lib/requirements/fastPlanDraftSuggestionPick";

describe("fastPlanDraftSuggestionPick", () => {
  it("resolves generate artifact action from fast plan draft chip label", () => {
    expect(resolveFastPlanDraftSuggestionAction("이 초안으로 빠른 기획안 생성")).toBe("generate_artifact");
    expect(resolveFastPlanDraftSuggestionAction(`  ${FAST_PLAN_DRAFT_ACTION_GENERATE}  `)).toBe("generate_artifact");
  });
});
