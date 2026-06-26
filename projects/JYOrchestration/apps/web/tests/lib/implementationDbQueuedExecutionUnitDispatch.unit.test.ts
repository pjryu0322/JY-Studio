import { describe, expect, it } from "vitest";
import { mapDbQueuedAdvanceToNextExecutionUnitDispatchInput } from "@/lib/prototype/implementationDbQueuedExecutionUnitDispatch";

describe("mapDbQueuedAdvanceToNextExecutionUnitDispatchInput", () => {
  it("forwards actorUserId when non-empty", () => {
    const mapped = mapDbQueuedAdvanceToNextExecutionUnitDispatchInput({
      projectId: "p1",
      actorUserId: "user-42",
      nowIso: "2026-06-01T00:00:00.000Z",
    });
    expect(mapped).toEqual({
      projectId: "p1",
      actorUserId: "user-42",
      nowIso: "2026-06-01T00:00:00.000Z",
    });
  });

  it("omits actorUserId when empty", () => {
    const mapped = mapDbQueuedAdvanceToNextExecutionUnitDispatchInput({
      projectId: "p1",
      actorUserId: "  ",
    });
    expect(mapped).toEqual({ projectId: "p1" });
    expect(mapped).not.toHaveProperty("actorUserId");
  });
});
