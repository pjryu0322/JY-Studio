import { describe, expect, it } from "vitest";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  detectCodeTaskRunIdentitySplit,
  resolveCanonicalCodeTaskRunId,
} from "@/lib/prototype/codeTaskExecutionRunIdentity";
import { materializeSelectedCodeTaskRuns } from "@/lib/prototype/implementationRuntimeRunMaterialization";
import { findDispatchableRunForCodeTask } from "@/lib/prototype/codeTaskExecutionRun";

const NOW = "2026-06-04T00:00:00.000Z";

function run(partial: Partial<CodeTaskExecutionRunV1>): CodeTaskExecutionRunV1 {
  return {
    runId: partial.runId ?? "run-json",
    version: "code_task_execution_run_v1",
    projectId: "p1",
    processTaskId: partial.processTaskId ?? "DEV-A",
    workItemId: "wi-1",
    codeTaskId: partial.codeTaskId ?? "CT-1",
    status: partial.status ?? "queued",
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...partial,
  };
}

const plan = {
  version: "implementation_code_task_plan_v1" as const,
  projectId: "p1",
  createdAt: NOW,
  updatedAt: NOW,
  source: "implementation_task_list" as const,
  tasks: [
    {
      codeTaskId: "CT-1",
      parentTaskId: "DEV-A",
      title: "A",
      description: "",
      changeType: "feature" as const,
      targetHints: [],
      dependencies: [],
      acceptanceCriteria: [],
      verificationHints: [],
      forbiddenPaths: [],
    },
    {
      codeTaskId: "CT-2",
      parentTaskId: "DEV-B",
      title: "B",
      description: "",
      changeType: "feature" as const,
      targetHints: [],
      dependencies: [],
      acceptanceCriteria: [],
      verificationHints: [],
      forbiddenPaths: [],
    },
  ],
  readiness: { ready: true, missing: [] },
};

const workItems = [
  {
    id: "cursor-wi-CT-1",
    codeTaskId: "CT-1",
    taskId: "DEV-A",
    title: "wi",
    status: "ready",
  },
  {
    id: "cursor-wi-CT-2",
    codeTaskId: "CT-2",
    taskId: "DEV-B",
    title: "wi",
    status: "ready",
  },
] as import("@/lib/prototype/implementationCursorWorkItems").CursorWorkItem[];

describe("P3-M43 materializeSelectedCodeTaskRuns", () => {
  it("creates runs for all selected code tasks", () => {
    const result = materializeSelectedCodeTaskRuns({
      projectId: "p1",
      selectedCodeTaskIds: ["CT-1", "CT-2"],
      codeTaskPlan: plan,
      taskList: null,
      cursorWorkItems: workItems,
      existingRuns: [],
      nowIso: NOW,
    });
    expect(result.runs).toHaveLength(2);
    expect(result.createdRunIds).toHaveLength(2);
    expect(result.executionOrder).toHaveLength(2);
  });

  it("reuses existing dispatchable run", () => {
    const existing = [run({ codeTaskId: "CT-1", runId: "existing-1" })];
    const result = materializeSelectedCodeTaskRuns({
      projectId: "p1",
      selectedCodeTaskIds: ["CT-1"],
      codeTaskPlan: plan,
      taskList: null,
      cursorWorkItems: workItems,
      existingRuns: existing,
      nowIso: NOW,
    });
    expect(result.reusedRunIds).toEqual(["existing-1"]);
    expect(result.createdRunIds).toHaveLength(0);
    expect(findDispatchableRunForCodeTask(result.runs, "CT-1")?.runId).toBe("existing-1");
  });
});

describe("P3-M43 resolveCanonicalCodeTaskRunId", () => {
  it("prefers json run id", () => {
    expect(
      resolveCanonicalCodeTaskRunId({
        projectId: "p1",
        codeTaskId: "CT-1",
        existingRuns: [run({ codeTaskId: "CT-1", runId: "json-run" })],
      }),
    ).toBe("json-run");
  });

  it("uses db run id when json missing", () => {
    expect(
      resolveCanonicalCodeTaskRunId({
        projectId: "p1",
        codeTaskId: "CT-1",
        existingRuns: [],
        existingRuntimeRuns: [
          {
            id: "db-run-1",
            codeTaskId: "CT-1",
            runtimeState: "queued",
          } as import("@/lib/runtime/implementationRuntime/implementationRuntimeTypes").ImplementationRuntimeRunView,
        ],
      }),
    ).toBe("db-run-1");
  });
});

describe("P3-M43 run identity split", () => {
  it("detects multiple run ids for same code task", () => {
    const split = detectCodeTaskRunIdentitySplit({
      codeTaskId: "CT-1",
      canonicalRunId: "canonical",
      existingRuns: [run({ codeTaskId: "CT-1", runId: "other" })],
      existingRuntimeRuns: [
        {
          id: "canonical",
          codeTaskId: "CT-1",
          runtimeState: "queued",
        } as import("@/lib/runtime/implementationRuntime/implementationRuntimeTypes").ImplementationRuntimeRunView,
      ],
    });
    expect(split?.observedRunIds.length).toBeGreaterThan(1);
  });
});

describe("P3-M43 ensureNextQuickRunDispatchRuntimeReady", () => {
  it("module exports ensure helpers", async () => {
    const mod = await import("@/lib/prototype/implementationRuntimeRunMaterialization");
    expect(typeof mod.ensureQueuedRuntimeRunForCodeTask).toBe("function");
    expect(typeof mod.ensureNextQuickRunDispatchRuntimeReady).toBe("function");
  });
});
