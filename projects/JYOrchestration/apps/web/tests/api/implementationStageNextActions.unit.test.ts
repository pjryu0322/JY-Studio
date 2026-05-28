import { describe, expect, it } from "vitest";
import { deriveImplementationStageNextActions } from "@/lib/prototype/implementationStageNextActions";

describe("deriveImplementationStageNextActions", () => {
  it("not_ready -> SHOW_ENV_CHECK primary", () => {
    const actions = deriveImplementationStageNextActions("not_ready");
    expect(actions[0]?.actionId).toBe("SHOW_ENV_CHECK");
    expect(actions[0]?.priority).toBe("primary");
  });

  it("implementation_ready -> GENERATE_IMPLEMENTATION_WORK_PLAN primary", () => {
    const actions = deriveImplementationStageNextActions("implementation_ready");
    expect(actions[0]?.actionId).toBe("GENERATE_IMPLEMENTATION_WORK_PLAN");
    expect(actions[0]?.priority).toBe("primary");
  });

  it("work_plan_drafted -> confirm primary + edit secondary", () => {
    const actions = deriveImplementationStageNextActions("work_plan_drafted");
    expect(actions.map((a) => a.actionId)).toEqual([
      "CONFIRM_IMPLEMENTATION_WORK_PLAN",
      "EDIT_IMPLEMENTATION_SCOPE",
    ]);
    expect(actions[0]?.priority).toBe("primary");
    expect(actions[1]?.priority).toBe("secondary");
  });

  it("work_plan_confirmed -> mock primary + db review secondary", () => {
    const actions = deriveImplementationStageNextActions("work_plan_confirmed");
    expect(actions.map((a) => a.actionId)).toEqual([
      "CONFIRM_MOCK_IMPLEMENTATION",
      "REVIEW_DB_INTEGRATION",
    ]);
  });
});

