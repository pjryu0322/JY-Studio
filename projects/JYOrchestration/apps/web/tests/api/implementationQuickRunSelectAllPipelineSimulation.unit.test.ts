import { describe, expect, it } from "vitest";
import {
  buildImplementationExecutionBoardFromRequirementsState,
} from "@/lib/prototype/implementationExecutionBoard";
import type { ImplementationAutoQualityGateV1 } from "@/lib/prototype/implementationAutoQualityGate";
import {
  IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
  type ImplementationCodeTaskPlanV1,
  type ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { deriveIntegratedExecutionStateReadiness } from "@/lib/prototype/implementationIntegratedExecutionState";
import {
  buildImplementationQuickRunStartedPatch,
} from "@/lib/prototype/implementationQuickRun";
import {
  planQuickRunCodeTaskContinuationAfterAutoGate,
  resolveCompletedCodeTaskId,
} from "@/lib/prototype/implementationQuickRunCodeTaskContinuation";
import {
  advanceSimulatedQuickRunJob,
  createSimulatedQuickRunJobBundle,
  markSimulatedRunTerminal,
  simulateSelectAllQuickRunSequentialExecution,
} from "@/lib/prototype/implementationQuickRunPipelineSimulation";
import { resolveCodeTaskTreeSelectAll } from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksDoneForWip,
} from "@/lib/prototype/implementationTaskExecutionState";
import type { ImplementationTaskListV1, ImplementationTaskV1 } from "@/lib/requirements/implementationTaskList";
import { TASK_CURSOR_EXECUTION_VERSION, type TaskCursorExecutionV1 } from "@/lib/prototype/taskCursorExecution";

const NOW = "2026-06-05T12:00:00.000Z";
const PROJECT_ID = "p-quick-run-sim";

function devTask(taskId: string): ImplementationTaskV1 {
  return {
    taskId,
    title: taskId,
    description: "d",
    taskType: "feature",
    ownerRole: "developer",
    priority: "high",
    dependencies: [],
    acceptanceCriteria: [],
    status: "ready",
    sourceRefs: [],
  };
}

function codeTask(
  codeTaskId: string,
  parentTaskId: string,
  title: string,
): ImplementationCodeTaskV1 {
  return {
    codeTaskId,
    parentTaskId,
    title,
    description: title,
    changeType: "component",
    targetHints: [],
    candidateFileHints: [],
    dependencies: [],
    parentTaskDependencies: [],
    codeTaskDependencies: [],
    acceptanceCriteria: [],
    verificationHints: [],
    forbiddenPaths: [],
    priority: "P1",
    status: "ready",
    blockers: [],
  };
}

function meetingRoomPlan(): ImplementationCodeTaskPlanV1 {
  const tasks = [
    codeTask("CODE-DEV-FRAME-001-001", "DEV-FRAME-001", "Frame shell"),
    codeTask("CODE-DEV-FEATURE-001-001", "DEV-FEATURE-001", "Feature UI"),
    codeTask("CODE-DEV-COMMON-001-001", "DEV-COMMON-001", "Shared utils"),
  ];
  return {
    version: IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_task_list",
    parentTaskCount: 3,
    codeTaskCount: tasks.length,
    tasks,
    readiness: { ready: true, missing: [] },
    validationReport: { status: "passed", checkedAt: NOW, errors: [], warnings: [] },
  };
}

function meetingRoomTaskList(): ImplementationTaskListV1 {
  return {
    version: 1,
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks: [
      devTask("DEV-FRAME-001"),
      devTask("DEV-FEATURE-001"),
      devTask("DEV-COMMON-001"),
    ],
    roleSummary: { developer: 3, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

function workItemsForPlan(plan: ImplementationCodeTaskPlanV1): CursorWorkItem[] {
  return plan.tasks.map((t) => ({
    id: `wi-${t.codeTaskId}`,
    taskId: t.parentTaskId,
    codeTaskId: t.codeTaskId,
    title: t.title,
    prompt: `Implement ${t.title}`,
    requiredFilesHint: [],
    expectedOutput: [],
    testCommands: ["pnpm test"],
    forbiddenPaths: [],
    blocked: false,
    blockers: [],
    qualityGate: { score: 1, promptReady: true, missing: [] },
  }));
}

function cursorExecutionForParent(
  parentTaskId: string,
  commitSha: string,
): TaskCursorExecutionV1 {
  return {
    version: TASK_CURSOR_EXECUTION_VERSION,
    projectId: PROJECT_ID,
    taskId: parentTaskId,
    workItemIds: [`wi-${parentTaskId}`],
    status: "scm_pending",
    cursorProvider: "cursor",
    targetRepository: "owner/repo",
    baseBranch: "main",
    workBranch: `wip/cursor/${parentTaskId.toLowerCase()}`,
    commitSha,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("Quick Run select-all pipeline simulation", () => {
  const plan = meetingRoomPlan();
  const taskList = meetingRoomTaskList();
  const workItems = workItemsForPlan(plan);

  it("select-all order is FRAME → FEATURE → COMMON (not alphabetical COMMON first)", () => {
    const selected = resolveCodeTaskTreeSelectAll({ selectAll: true, codeTaskPlan: plan });
    expect(selected).toEqual([
      "CODE-DEV-FRAME-001-001",
      "CODE-DEV-FEATURE-001-001",
      "CODE-DEV-COMMON-001-001",
    ]);
  });

  it("runs every selected CodeTask sequentially and completes the DB job", () => {
    const result = simulateSelectAllQuickRunSequentialExecution({
      projectId: PROJECT_ID,
      jobId: "job-sim-1",
      codeTaskPlan: plan,
    });

    expect(result.selectedCodeTaskIds).toHaveLength(3);
    expect(result.finalBundle.job?.status).toBe("completed");
    expect(result.finalBundle.job?.selectedCodeTaskIds).toEqual(result.selectedCodeTaskIds);

    const terminalSteps = result.steps.filter((s) => s.kind === "code_task_terminal");
    expect(terminalSteps.map((s) => (s.kind === "code_task_terminal" ? s.codeTaskId : ""))).toEqual(
      result.selectedCodeTaskIds,
    );

    const advanceSteps = result.steps.filter((s) => s.kind === "job_advanced");
    expect(advanceSteps[0]).toMatchObject({
      kind: "job_advanced",
      createdRunForCodeTaskId: "CODE-DEV-FEATURE-001-001",
    });
    expect(advanceSteps[1]).toMatchObject({
      kind: "job_advanced",
      createdRunForCodeTaskId: "CODE-DEV-COMMON-001-001",
    });
    expect(advanceSteps[2]).toMatchObject({
      kind: "job_advanced",
      createdRunForCodeTaskId: null,
    });
  });

  it("plans continuation after auto gate for each handoff in selection order", () => {
    const ids = plan.tasks.map((t) => t.codeTaskId);
    const quickRun = buildImplementationQuickRunStartedPatch({
      projectId: PROJECT_ID,
      selectedTaskIds: taskList.tasks.map((t) => t.taskId),
      nowIso: NOW,
    });

    for (let i = 0; i < ids.length - 1; i += 1) {
      let bundle = createSimulatedQuickRunJobBundle({
        projectId: PROJECT_ID,
        jobId: `job-handoff-${i}`,
        selectedCodeTaskIds: ids,
        nowIso: NOW,
      });
      for (let j = 0; j < i; j += 1) {
        bundle = markSimulatedRunTerminal({
          bundle,
          codeTaskId: ids[j]!,
          runtimeState: "completed",
          nowIso: NOW,
        });
        bundle = advanceSimulatedQuickRunJob({ bundle, nowIso: NOW }).bundle;
      }

      const completedCodeTaskId = ids[i]!;
      const parentTaskId = plan.tasks[i]!.parentTaskId;
      const nextCodeTaskId = ids[i + 1]!;
      const execution = cursorExecutionForParent(parentTaskId, `commit-${i}`);
      const autoGate: ImplementationAutoQualityGateV1 = {
        version: "implementation_auto_quality_gate_v1",
        projectId: PROJECT_ID,
        taskId: parentTaskId,
        status: "passed",
        sourceCommitSha: `commit-${i}`,
        createdAt: NOW,
        updatedAt: NOW,
      };

      expect(
        resolveCompletedCodeTaskId({
          execution,
          runs: [],
          dbBundle: bundle,
          codeTaskPlan: plan,
          taskList,
          cursorWorkItems: workItems,
        }),
      ).toBe(completedCodeTaskId);

      const planContinuation = planQuickRunCodeTaskContinuationAfterAutoGate({
        projectId: PROJECT_ID,
        quickRun,
        taskCursorExecution: execution,
        autoGate,
        runs: [],
        codeTaskPlan: plan,
        taskList,
        cursorWorkItems: workItems,
        dbBundle: bundle,
        baseState: {},
        nowIso: NOW,
      });
      expect(planContinuation?.nextCodeTaskId).toBe(nextCodeTaskId);
    }
  });

  it("unlocks integrated pipeline after all per-task developer pipelines complete", () => {
    simulateSelectAllQuickRunSequentialExecution({
      projectId: PROJECT_ID,
      jobId: "job-sim-3",
      codeTaskPlan: plan,
    });

    let executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: PROJECT_ID,
      taskList,
      nowIso: NOW,
    });
    executionState = markDeveloperTasksDoneForWip({
      state: executionState,
      cursorWorkItems: workItems,
      nowIso: NOW,
    });

    const board = buildImplementationExecutionBoardFromRequirementsState({
      projectId: PROJECT_ID,
      orchestration: {
        implementationTaskListV1: taskList,
        implementationTaskExecutionStateV1: executionState,
        implementationCodeTaskPlanV1: plan,
      },
    })!;

    expect(board.mode).toBe("sequential");
    expect(board.taskRows.every((row) => row.currentRole === "completed")).toBe(true);
    expect(board.summary.completedTasks).toBe(3);

    const integrated = deriveIntegratedExecutionStateReadiness({
      projectId: PROJECT_ID,
      state: undefined,
      integrationPipelineUnlocked: true,
      nowIso: NOW,
    });
    expect(integrated.items.find((item) => item.step === "refactor_common")?.status).toBe("ready");
    expect(integrated.items.find((item) => item.step === "integrated_review")?.status).toBe(
      "not_started",
    );
  });
});
