import { describe, expect, it } from "vitest";
import {
  checkCodeTaskDependencyReady,
  partitionCodeTaskIdsByDependencyReadiness,
} from "@/lib/prototype/codeTaskDependencyResolver";
import {
  advanceCodeTaskExecutionQueue,
  skipBlockedQueueCodeTasks,
  startCodeTaskExecutionQueue,
} from "@/lib/prototype/codeTaskExecutionQueue";
import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  isQueueContinueAfterRunStatus,
  isQueueIssueRunStatus,
  isTerminalCodeTaskExecutionRunStatus,
} from "@/lib/prototype/codeTaskExecutionRunStatus";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const NOW = "2026-06-01T12:00:00.000Z";

function run(
  codeTaskId: string,
  status: CodeTaskExecutionRunV1["status"],
): CodeTaskExecutionRunV1 {
  return {
    version: "code_task_execution_run_v1",
    runId: `run-${codeTaskId}`,
    projectId: "p1",
    processTaskId: "DEV-A",
    workItemId: `wi-${codeTaskId}`,
    codeTaskId,
    status,
    attemptNo: 1,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: NOW,
  };
}

function planWithDependencies(
  tasks: ImplementationCodeTaskPlanV1["tasks"],
): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    tasks,
  };
}

describe("codeTaskDependencyResolver", () => {
  it("4-1: codeTask dependency ready when prerequisite completed", () => {
    const plan = planWithDependencies([
      {
        codeTaskId: "A",
        parentTaskId: "DEV-A",
        title: "A",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        codeTaskDependencies: [],
      },
      {
        codeTaskId: "B",
        parentTaskId: "DEV-A",
        title: "B",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        codeTaskDependencies: ["A"],
      },
    ]);
    const result = checkCodeTaskDependencyReady({
      codeTaskId: "B",
      codeTaskPlan: plan,
      runs: [run("A", "completed")],
    });
    expect(result.status).toBe("ready");
  });

  it("4-1: codeTask dependency blocked when prerequisite rework_required", () => {
    const plan = planWithDependencies([
      {
        codeTaskId: "A",
        parentTaskId: "DEV-A",
        title: "A",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
      {
        codeTaskId: "B",
        parentTaskId: "DEV-A",
        title: "B",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        codeTaskDependencies: ["A"],
      },
    ]);
    const result = checkCodeTaskDependencyReady({
      codeTaskId: "B",
      codeTaskPlan: plan,
      runs: [run("A", "rework_required")],
    });
    expect(result.status).toBe("blocked");
    expect(result.incompleteCodeTaskIds).toContain("A");
  });

  it("4-2: parentTask dependency ready when all child code tasks completed", () => {
    const plan = planWithDependencies([
      {
        codeTaskId: "C1",
        parentTaskId: "DEV-COMMON-001",
        title: "C1",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
      {
        codeTaskId: "C2",
        parentTaskId: "DEV-COMMON-001",
        title: "C2",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
      {
        codeTaskId: "S1",
        parentTaskId: "DEV-SCREEN-001",
        title: "S1",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        parentTaskDependencies: ["DEV-COMMON-001"],
      },
    ]);
    const result = checkCodeTaskDependencyReady({
      codeTaskId: "S1",
      codeTaskPlan: plan,
      runs: [run("C1", "completed"), run("C2", "no_code_change_completed")],
    });
    expect(result.status).toBe("ready");
  });

  it("4-2: parentTask dependency blocked when child incomplete", () => {
    const plan = planWithDependencies([
      {
        codeTaskId: "C1",
        parentTaskId: "DEV-COMMON-001",
        title: "C1",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
      {
        codeTaskId: "C2",
        parentTaskId: "DEV-COMMON-001",
        title: "C2",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
      {
        codeTaskId: "S1",
        parentTaskId: "DEV-SCREEN-001",
        title: "S1",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        parentTaskDependencies: ["DEV-COMMON-001"],
      },
    ]);
    const result = checkCodeTaskDependencyReady({
      codeTaskId: "S1",
      codeTaskPlan: plan,
      runs: [run("C1", "completed")],
    });
    expect(result.status).toBe("blocked");
    expect(result.incompleteCodeTaskIds).toContain("C2");
  });

  it("4-3: unknown dependency", () => {
    const plan = planWithDependencies([
      {
        codeTaskId: "X",
        parentTaskId: "DEV-A",
        title: "X",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        codeTaskDependencies: ["UNKNOWN-ID"],
      },
    ]);
    const result = checkCodeTaskDependencyReady({
      codeTaskId: "X",
      codeTaskPlan: plan,
      runs: [],
    });
    expect(result.status).toBe("unknown_dependency");
    expect(result.unknownDependencyIds).toContain("UNKNOWN-ID");
  });

  it("4-4: queue start excludes blocked code tasks", () => {
    const plan = planWithDependencies([
      {
        codeTaskId: "A",
        parentTaskId: "DEV-A",
        title: "A",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
      {
        codeTaskId: "B",
        parentTaskId: "DEV-A",
        title: "B",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        codeTaskDependencies: ["A"],
      },
    ]);
    const partition = partitionCodeTaskIdsByDependencyReadiness({
      codeTaskIds: ["A", "B"],
      codeTaskPlan: plan,
      runs: [],
    });
    expect(partition.readyIds).toEqual(["A"]);
    expect(partition.blocked.map((item) => item.codeTaskId)).toEqual(["B"]);
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: partition.readyIds,
      nowIso: NOW,
    });
    expect(queue?.selectedCodeTaskIds).toEqual(["A"]);
    expect(
      startCodeTaskExecutionQueue({
        projectId: "p1",
        selectedCodeTaskIds: partition.readyIds.length ? partition.readyIds : [],
      }),
    ).not.toBeNull();
    expect(
      startCodeTaskExecutionQueue({
        projectId: "p1",
        selectedCodeTaskIds: [],
      }),
    ).toBeNull();
  });

  it("4-5: queue advance skips dependent code task when prerequisite failed", () => {
    const plan = planWithDependencies([
      {
        codeTaskId: "A",
        parentTaskId: "DEV-A",
        title: "A",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
      },
      {
        codeTaskId: "B",
        parentTaskId: "DEV-A",
        title: "B",
        description: "",
        changeType: "feature",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        codeTaskDependencies: ["A"],
      },
    ]);
    const queue = startCodeTaskExecutionQueue({
      projectId: "p1",
      selectedCodeTaskIds: ["A", "B"],
      nowIso: NOW,
    })!;
    const advanced = advanceCodeTaskExecutionQueue({
      queue,
      lastRunStatus: "failed",
      processedRunStatuses: ["failed"],
      nowIso: NOW,
    });
    expect(advanced.nextCodeTaskId).toBe("B");
    const skipped = skipBlockedQueueCodeTasks({
      queue: advanced.queue,
      nextCodeTaskId: advanced.nextCodeTaskId,
      processedRunStatuses: ["failed"],
      codeTaskPlan: plan,
      runs: [run("A", "failed")],
      nowIso: NOW,
    });
    expect(skipped.skippedCodeTaskIds).toEqual(["B"]);
    expect(skipped.nextCodeTaskId).toBeNull();
    expect(skipped.finished).toBe(true);
    expect(skipped.queue.status).toBe("completed_with_issues");
  });

  it("4-6: blocked_by_dependency queue status helpers", () => {
    expect(isTerminalCodeTaskExecutionRunStatus("blocked_by_dependency")).toBe(true);
    expect(isQueueIssueRunStatus("blocked_by_dependency")).toBe(true);
    expect(isQueueContinueAfterRunStatus("blocked_by_dependency")).toBe(true);
  });
});
