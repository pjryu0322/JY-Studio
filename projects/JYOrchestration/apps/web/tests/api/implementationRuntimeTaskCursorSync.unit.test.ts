import { describe, expect, it } from "vitest";
import {
  findRuntimeTransitionPath,
  mapTaskCursorStatusToRuntimeState,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeTaskCursorSync";

describe("implementationRuntimeTaskCursorSync", () => {
  it("maps cursor statuses to runtime states", () => {
    expect(mapTaskCursorStatusToRuntimeState("cursor_requested")).toBe("dispatching");
    expect(mapTaskCursorStatusToRuntimeState("cursor_running")).toBe("cursor_running");
    expect(mapTaskCursorStatusToRuntimeState("cursor_completed")).toBe("github_verifying");
    expect(mapTaskCursorStatusToRuntimeState("github_verifying")).toBe("github_verifying");
    expect(mapTaskCursorStatusToRuntimeState("github_verified")).toBe("completed");
    expect(mapTaskCursorStatusToRuntimeState("cursor_failed")).toBe("failed");
  });

  it("finds multi-hop path queued → cursor_running", () => {
    expect(findRuntimeTransitionPath("queued", "cursor_running")).toEqual([
      "dispatching",
      "cursor_running",
    ]);
  });

  it("finds path cursor_running → completed via github_verifying", () => {
    expect(findRuntimeTransitionPath("cursor_running", "completed")).toEqual([
      "github_verifying",
      "completed",
    ]);
  });
});
