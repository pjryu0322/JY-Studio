import { describe, expect, it } from "vitest";
import {
  deriveImplementationRuntimeState,
  evaluateRuntimeRecovery,
  formatRuntimeStateKo,
  isRuntimeInFlight,
} from "@/lib/prototype/implementationRuntimeState";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";

const NOW = "2026-06-02T12:00:00.000Z";

function sampleRun(overrides: Partial<CodeTaskExecutionRunV1> = {}): CodeTaskExecutionRunV1 {
  return {
    version: "code_task_execution_run_v1",
    runId: "run-1",
    projectId: "p1",
    processTaskId: "DEV-A",
    workItemId: "wi-1",
    codeTaskId: "CT-1",
    status: "queued",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("implementationRuntimeState", () => {
  it("treats queued as waiting, not in-flight", () => {
    expect(isRuntimeInFlight("queued")).toBe(false);
    expect(isRuntimeInFlight("dispatching")).toBe(true);
    expect(isRuntimeInFlight("cursor_running")).toBe(true);
    expect(isRuntimeInFlight("github_verifying")).toBe(true);
  });

  it("derives dispatching from cursor_requested run", () => {
    const runtime = deriveImplementationRuntimeState({
      projectId: "p1",
      runs: [sampleRun({ status: "cursor_requested" })],
      queue: {
        version: "code_task_execution_queue_v1",
        projectId: "p1",
        selectedCodeTaskIds: ["CT-1"],
        currentIndex: 0,
        status: "running",
        createdAt: NOW,
        updatedAt: NOW,
      },
    });
    expect(runtime.runtimeState).toBe("dispatching");
  });

  it("detects orphan queued for redispatch", () => {
    const runtime = deriveImplementationRuntimeState({
      projectId: "p1",
      runs: [sampleRun({ status: "queued" })],
      queue: {
        version: "code_task_execution_queue_v1",
        projectId: "p1",
        selectedCodeTaskIds: ["CT-1"],
        currentIndex: 0,
        status: "running",
        createdAt: NOW,
        updatedAt: NOW,
      },
    });
    const plan = evaluateRuntimeRecovery({
      runtime,
      queue: {
        version: "code_task_execution_queue_v1",
        projectId: "p1",
        selectedCodeTaskIds: ["CT-1"],
        currentIndex: 0,
        status: "running",
        createdAt: NOW,
        updatedAt: NOW,
      },
      runs: [sampleRun({ status: "queued" })],
      nowIso: NOW,
    });
    expect(plan.shouldRedispatch).toBe(true);
    expect(plan.issues).toContain("orphan_queued");
  });

  it("formats runtime labels for UI", () => {
    expect(formatRuntimeStateKo("github_verifying")).toBe("github_verifying");
    expect(formatRuntimeStateKo("stale")).toBe("stale");
  });
});
