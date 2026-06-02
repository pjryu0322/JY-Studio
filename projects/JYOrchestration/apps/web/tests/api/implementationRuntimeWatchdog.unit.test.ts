import { describe, expect, it } from "vitest";
import { evaluateImplementationRuntimeWatchdog } from "@/lib/runtime/implementationRuntime/implementationRuntimeWatchdog";
import type { ImplementationRuntimeRunView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

function runView(
  partial: Partial<ImplementationRuntimeRunView> & Pick<ImplementationRuntimeRunView, "runtimeState">,
): ImplementationRuntimeRunView {
  return {
    id: "run-1",
    projectId: "proj-1",
    jobId: "job-1",
    codeTaskId: "ct-1",
    cursorAgentId: null,
    branchName: null,
    commitSha: null,
    pullRequestUrl: null,
    failureReason: null,
    lastHeartbeatAt: null,
    startedAt: null,
    completedAt: null,
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

describe("evaluateImplementationRuntimeWatchdog", () => {
  it("requests poll when cursor_running stalls 5+ minutes", () => {
    const result = evaluateImplementationRuntimeWatchdog({
      run: runView({
        runtimeState: "cursor_running",
        lastHeartbeatAt: "2026-06-01T00:00:00.000Z",
      }),
      nowIso: "2026-06-01T00:06:00.000Z",
    });
    expect(result.shouldPoll).toBe(true);
    expect(result.issues).toContain("watchdog_poll");
  });

  it("marks stale after 30 minutes without heartbeat", () => {
    const result = evaluateImplementationRuntimeWatchdog({
      run: runView({
        runtimeState: "cursor_running",
        lastHeartbeatAt: "2026-06-01T00:00:00.000Z",
      }),
      nowIso: "2026-06-01T00:31:00.000Z",
    });
    expect(result.markStale).toBe(true);
    expect(result.issues).toContain("orphan_cursor_running");
  });
});
