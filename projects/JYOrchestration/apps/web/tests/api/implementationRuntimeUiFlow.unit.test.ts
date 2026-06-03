import { describe, expect, it } from "vitest";
import {
  hasDbImplementationRuntimeJob,
  resolveDbPreferredRuntimeState,
  shouldPollImplementationRuntime,
} from "@/lib/runtime/implementationRuntime/implementationRuntimeUiFlow";
import type { ImplementationRuntimeBundleView } from "@/lib/runtime/implementationRuntime/implementationRuntimeTypes";

const bundle = (partial: Partial<ImplementationRuntimeBundleView>): ImplementationRuntimeBundleView => ({
  job: null,
  runs: [],
  currentRun: null,
  ...partial,
});

describe("implementationRuntimeUiFlow", () => {
  it("detects active DB job", () => {
    expect(hasDbImplementationRuntimeJob(null)).toBe(false);
    expect(
      hasDbImplementationRuntimeJob(
        bundle({
          job: {
            id: "j1",
            projectId: "p1",
            status: "running",
            currentCodeTaskId: "ct-1",
            selectedCodeTaskIds: ["ct-1"],
            failureReason: null,
            startedAt: null,
            completedAt: null,
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        }),
      ),
    ).toBe(true);
  });

  it("prefers DB currentRun runtime state when job exists", () => {
    const state = resolveDbPreferredRuntimeState(
      bundle({
        job: {
          id: "j1",
          projectId: "p1",
          status: "running",
          currentCodeTaskId: "ct-1",
          selectedCodeTaskIds: ["ct-1"],
          failureReason: null,
          startedAt: null,
          completedAt: null,
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
        currentRun: {
          id: "r1",
          projectId: "p1",
          jobId: "j1",
          codeTaskId: "ct-1",
          runtimeState: "cursor_running",
          cursorAgentId: "a1",
          branchName: null,
          commitSha: null,
          pullRequestUrl: null,
          failureReason: null,
          lastHeartbeatAt: "2026-06-01T00:00:00.000Z",
          startedAt: null,
          completedAt: null,
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      }),
    );
    expect(state).toBe("cursor_running");
  });

  it("polls when DB job is running or legacy queue is running", () => {
    expect(
      shouldPollImplementationRuntime({
        bundle: bundle({
          job: {
            id: "j1",
            projectId: "p1",
            status: "running",
            currentCodeTaskId: "ct-1",
            selectedCodeTaskIds: ["ct-1"],
            failureReason: null,
            startedAt: null,
            completedAt: null,
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        }),
        legacyQueueRunning: false,
        legacyCursorInFlight: false,
      }),
    ).toBe(true);
    expect(
      shouldPollImplementationRuntime({
        bundle: null,
        legacyQueueRunning: true,
        legacyCursorInFlight: false,
      }),
    ).toBe(true);
    expect(
      shouldPollImplementationRuntime({
        bundle: null,
        legacyQueueRunning: false,
        legacyCursorInFlight: false,
      }),
    ).toBe(false);
  });
});
