import { describe, expect, it } from "vitest";
import {
  IMPLEMENTATION_RUNTIME_LAUNCH_GRACE_MS,
  isMissingCursorAgentIdDuringLaunchGrace,
  isWithinImplementationRuntimeLaunchGrace,
  shouldDeferRuntimeRecoveryForLaunchGrace,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeLaunchGrace";
import { TASK_CURSOR_EXECUTION_VERSION } from "@/lib/prototype/taskCursorExecution";

describe("implementationRuntimeLaunchGrace", () => {
  const nowMs = Date.parse("2026-06-02T15:00:00.000Z");

  it("defers recovery during launch grace with server polling", () => {
    const execution = {
      version: TASK_CURSOR_EXECUTION_VERSION,
      projectId: "p1",
      taskId: "DEV-FRAME-001",
      workItemIds: [],
      status: "cursor_running" as const,
      cursorProvider: "cursor" as const,
      targetRepository: "org/repo",
      baseBranch: "main",
      workBranch: "wip/cursor/dev-frame-001",
      createdAt: "2026-06-02T14:58:30.000Z",
      updatedAt: "2026-06-02T14:58:30.000Z",
    };
    expect(
      shouldDeferRuntimeRecoveryForLaunchGrace({
        execution,
        pollCount: 0,
        serverPolling: true,
        nowMs,
      }),
    ).toBe(true);
  });

  it("does not treat missing agent id as abandoned during grace", () => {
    const execution = {
      version: TASK_CURSOR_EXECUTION_VERSION,
      projectId: "p1",
      taskId: "DEV-FRAME-001",
      workItemIds: [],
      status: "cursor_running" as const,
      cursorProvider: "cursor" as const,
      targetRepository: "org/repo",
      baseBranch: "main",
      workBranch: "wip/cursor/dev-frame-001",
      createdAt: "2026-06-02T14:58:30.000Z",
      updatedAt: "2026-06-02T14:58:30.000Z",
    };
    expect(
      isMissingCursorAgentIdDuringLaunchGrace({
        execution,
        pollCount: 0,
        serverPolling: true,
        nowMs,
      }),
    ).toBe(true);
  });

  it("expires grace after configured window", () => {
    expect(
      isWithinImplementationRuntimeLaunchGrace({
        anchorIso: "2026-06-02T14:00:00.000Z",
        nowMs,
        graceMs: IMPLEMENTATION_RUNTIME_LAUNCH_GRACE_MS,
      }),
    ).toBe(false);
  });
});
