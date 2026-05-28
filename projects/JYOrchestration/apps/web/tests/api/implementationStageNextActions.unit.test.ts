import { describe, expect, it } from "vitest";
import {
  deriveImplementationStageNextActions,
  prioritizeImplementationChipsByNextActions,
} from "@/lib/prototype/implementationStageNextActions";
import { AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP } from "@/lib/prototype/implementationTaskListEntryMessage";

describe("deriveImplementationStageNextActions", () => {
  it("not_ready -> SHOW_ENV_CHECK primary", () => {
    const actions = deriveImplementationStageNextActions("not_ready");
    expect(actions[0]?.actionId).toBe("SHOW_ENV_CHECK");
    expect(actions[0]?.priority).toBe("primary");
  });

  it("task_list_ready -> AI developer implementation request primary", () => {
    const actions = deriveImplementationStageNextActions("task_list_ready");
    expect(actions[0]?.label).toBe(AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP);
    expect(actions[0]?.priority).toBe("primary");
    expect(actions[0]?.label).not.toBe("구현 작업안 초안 생성");
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

describe("prioritizeImplementationChipsByNextActions", () => {
  it("sorts chips by primary/secondary next actions", () => {
    const nextActions = deriveImplementationStageNextActions("work_plan_drafted");
    const sorted = prioritizeImplementationChipsByNextActions({
      labels: ["산출물 다시 보기", "구현 범위 수정", "구현 작업안 확정"],
      nextActions,
    });
    expect(sorted).toEqual(["구현 작업안 확정", "구현 범위 수정", "산출물 다시 보기"]);
  });

  it("keeps unknown chips after prioritized chips in original order", () => {
    const nextActions = deriveImplementationStageNextActions("implementation_ready");
    const sorted = prioritizeImplementationChipsByNextActions({
      labels: ["알 수 없는 칩", "구현 작업안 초안 생성", "다른 칩"],
      nextActions,
    });
    expect(sorted[0]).toBe("구현 작업안 초안 생성");
    expect(sorted.slice(1)).toEqual(["알 수 없는 칩", "다른 칩"]);
  });

  it("preserves order among chips with equal priority", () => {
    const sorted = prioritizeImplementationChipsByNextActions({
      labels: ["B", "A"],
      nextActions: [],
    });
    expect(sorted).toEqual(["B", "A"]);
  });
});

