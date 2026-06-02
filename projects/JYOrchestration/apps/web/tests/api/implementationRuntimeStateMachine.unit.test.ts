import { describe, expect, it } from "vitest";
import {
  assertRuntimeTransition,
  canTransitionRuntimeState,
  ImplementationRuntimeTransitionError,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeStateMachine";

describe("ImplementationRuntimeStateMachine", () => {
  it("allows happy path transitions", () => {
    expect(canTransitionRuntimeState("idle", "queued")).toBe(true);
    expect(canTransitionRuntimeState("queued", "dispatching")).toBe(true);
    expect(canTransitionRuntimeState("dispatching", "cursor_running")).toBe(true);
    expect(canTransitionRuntimeState("cursor_running", "github_verifying")).toBe(true);
    expect(canTransitionRuntimeState("github_verifying", "completed")).toBe(true);
  });

  it("forbids queued → completed", () => {
    expect(canTransitionRuntimeState("queued", "completed")).toBe(false);
    expect(() => assertRuntimeTransition("queued", "completed")).toThrow(
      ImplementationRuntimeTransitionError,
    );
  });

  it("allows failure and stale recovery paths", () => {
    expect(canTransitionRuntimeState("dispatching", "failed")).toBe(true);
    expect(canTransitionRuntimeState("cursor_running", "stale")).toBe(true);
    expect(canTransitionRuntimeState("stale", "queued")).toBe(true);
  });
});
