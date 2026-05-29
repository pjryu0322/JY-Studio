import { describe, expect, it } from "vitest";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksDoneForWip,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksDone,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  deriveImplementationStageNextActions,
  prioritizeImplementationChipsByNextActions,
  prioritizeImplementationChipsForState,
} from "@/lib/prototype/implementationStageNextActions";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
  IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
  REVIEWER_CHECK_CHIP,
  REVIEWER_CHECK_RUN_CHIP,
  RUN_FINAL_SCM_CHIP,
  RUN_INTEGRATED_REVIEW_CHIP,
  RUN_INTEGRATED_SECURITY_CHIP,
  RUN_REFACTOR_COMMON_CHIP,
  SCM_CRITERIA_CHIP,
  SECURITY_CHECK_CHIP,
  SECURITY_CHECK_RUN_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import {
  deriveIntegratedExecutionStateReadiness,
  markIntegratedStepDone,
  markIntegratedStepInProgress,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import { executeImplementationQualityGateCheck } from "@/lib/prototype/implementationQualityGate";
import {
  deriveImplementationPrototypeRunSyncSnapshot,
  syncImplementationTaskExecutionFromPrototypeRun,
} from "@/lib/prototype/implementationPrototypeRunSync";
import { markRoleTasksInProgress } from "@/lib/prototype/implementationTaskExecutionState";
import type { EffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";

describe("deriveImplementationStageNextActions", () => {
  it("not_ready -> SHOW_ENV_CHECK primary", () => {
    const actions = deriveImplementationStageNextActions("not_ready");
    expect(actions[0]?.actionId).toBe("SHOW_ENV_CHECK");
    expect(actions[0]?.priority).toBe("primary");
  });

  it("task_list_ready -> AI developer implementation request primary", () => {
    const actions = deriveImplementationStageNextActions("task_list_ready");
    expect(actions[0]?.label).toBe(AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP);
    expect(actions[0]?.priority).toBe("primary");
    expect(actions[0]?.label).not.toBe("구현 작업안 초안 생성");
  });

  it("implementation_ready -> GENERATE_IMPLEMENTATION_WORK_PLAN primary", () => {
    const actions = deriveImplementationStageNextActions("implementation_ready");
    expect(actions[0]?.actionId).toBe("GENERATE_IMPLEMENTATION_WORK_PLAN");
    expect(actions[0]?.priority).toBe("primary");
  });

  it("work_plan_drafted -> confirm primary + edit secondary", () => {
    const actions = deriveImplementationStageNextActions("work_plan_drafted");
    expect(actions.map((a) => a.actionId)).toEqual([
      "CONFIRM_IMPLEMENTATION_WORK_PLAN",
      "EDIT_IMPLEMENTATION_SCOPE",
    ]);
    expect(actions[0]?.priority).toBe("primary");
    expect(actions[1]?.priority).toBe("secondary");
  });

  it("work_plan_confirmed -> mock primary + db review secondary", () => {
    const actions = deriveImplementationStageNextActions("work_plan_confirmed");
    expect(actions.map((a) => a.actionId)).toEqual([
      "CONFIRM_MOCK_IMPLEMENTATION",
      "REVIEW_DB_INTEGRATION",
    ]);
  });
});

describe("deriveImplementationStageNextActions with execution state", () => {
  const NOW = "2026-05-28T00:00:00.000Z";

  function makeSeed(): ImplementationSeedV1 {
    return {
      version: "implementation_seed_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "planning_slots_and_artifacts",
      lifecycleStatus: "confirmed",
      readiness: { ready: true, score: 1, missing: [], warnings: [] },
      processImplementationItems: [],
      screenImplementationItems: [],
      actorCapabilityMatrix: [],
      commonDetailFeatures: [],
      dataModelSeed: { entities: [], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
      assumptions: [],
      gaps: [],
    };
  }

  it("prioritizes reviewer/security/scm chips after developer done and post-review queued", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    const workItems: readonly CursorWorkItem[] = taskList.tasks
      .filter((t) => t.ownerRole === "developer")
      .map((t) => ({
        id: "wi-dev",
        taskId: t.taskId,
        title: t.title,
        prompt: "p",
        requiredFilesHint: [],
        expectedOutput: [],
        testCommands: [],
        forbiddenPaths: [],
        blocked: false,
        blockers: [],
        qualityGate: { score: 1, promptReady: true, missing: [] },
      }));
    let executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    executionState = markDeveloperTasksDoneForWip({ state: executionState, cursorWorkItems: workItems, nowIso: NOW });
    executionState = markPostDeveloperReviewTasksQueued({ state: executionState, nowIso: NOW });

    const actions = deriveImplementationStageNextActions("task_list_ready", executionState);
    expect(actions[0]?.label).toBe(REVIEWER_CHECK_RUN_CHIP);

    const effectiveState = {
      implementationSeedV1: makeSeed(),
      implementationTaskListV1: taskList,
      implementationWorkPlanDraftV1: null,
      implementationTaskPlanV1: null,
      implementationDbStrategyV1: null,
      envOk: true,
      designOk: true,
      latestRun: null,
      hasWorkUnits: false,
      plannerRunning: false,
      plannerCreatePending: false,
      protoBusy: false,
    } satisfies EffectiveImplementationState;

    const sorted = prioritizeImplementationChipsForState(
      [
        SCM_CRITERIA_CHIP,
        SECURITY_CHECK_RUN_CHIP,
        AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
        REVIEWER_CHECK_RUN_CHIP,
      ],
      effectiveState,
      executionState,
    );
    expect(sorted[0]).toBe(REVIEWER_CHECK_RUN_CHIP);
    expect(sorted[1]).toBe(SECURITY_CHECK_RUN_CHIP);
  });

  it("prioritizes remediation request when reviewer gate failed", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    let executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    executionState = markPostDeveloperReviewTasksQueued({ state: executionState, nowIso: NOW });
    const gate = executeImplementationQualityGateCheck({
      role: "reviewer",
      taskList,
      executionState: {
        ...executionState,
        items: executionState.items.map((item) =>
          item.ownerRole === "developer" ? { ...item, status: "failed" as const } : item,
        ),
      },
      projectId: "p1",
      nowIso: NOW,
    });
    if ("blocked" in gate) throw new Error("expected gate outcome");
    const actions = deriveImplementationStageNextActions("task_list_ready", gate.executionState);
    expect(actions[0]?.label).toBe(AI_DEVELOPER_REMEDIATION_REQUEST_CHIP);
    expect(actions[0]?.priority).toBe("primary");
  });

  it("prototype_ready prioritizes preview/view result and not AI developer request", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    const workItems: readonly CursorWorkItem[] = taskList.tasks
      .filter((t) => t.ownerRole === "developer")
      .map((t) => ({
        id: "wi-dev",
        taskId: t.taskId,
        title: t.title,
        prompt: "p",
        requiredFilesHint: [],
        expectedOutput: [],
        testCommands: [],
        forbiddenPaths: [],
        blocked: false,
        blockers: [],
        qualityGate: { score: 1, promptReady: true, missing: [] },
      }));
    let executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    executionState = markDeveloperTasksDoneForWip({
      state: executionState,
      cursorWorkItems: workItems,
      nowIso: NOW,
    });
    executionState = markPostDeveloperReviewTasksQueued({ state: executionState, nowIso: NOW });
    executionState = markRoleTasksInProgress({ state: executionState, ownerRole: "scm", nowIso: NOW });
    const latestRun = {
      id: "run-1",
      status: "PREVIEW_READY",
      previewUrl: "https://preview.example/app",
      workUnits: [],
    };
    const prototypeSnapshot = deriveImplementationPrototypeRunSyncSnapshot({ latestRun });
    executionState = syncImplementationTaskExecutionFromPrototypeRun({
      state: executionState,
      snapshot: prototypeSnapshot,
      nowIso: NOW,
    })!;

    const actions = deriveImplementationStageNextActions("prototype_ready", executionState, prototypeSnapshot);
    expect(actions[0]?.label).toBe(IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP);
    expect(actions[0]?.priority).toBe("primary");
    expect(actions.some((a) => a.priority === "primary" && a.label === AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP)).toBe(
      false,
    );
  });
});

describe("deriveImplementationStageNextActions integrated board", () => {
  const NOW = "2026-05-28T12:00:00.000Z";

  function makeSeedForBoard(): ImplementationSeedV1 {
    return {
      version: "implementation_seed_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "planning_slots_and_artifacts",
      lifecycleStatus: "confirmed",
      readiness: { ready: true, score: 1, missing: [], warnings: [] },
      processImplementationItems: [],
      screenImplementationItems: [],
      actorCapabilityMatrix: [],
      commonDetailFeatures: [],
      dataModelSeed: { entities: [], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
      assumptions: [],
      gaps: [],
    };
  }

  function completedBoardInput() {
    const seed = makeSeedForBoard();
    const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed });
    const workItems: readonly CursorWorkItem[] = taskList.tasks
      .filter((t) => t.ownerRole === "developer")
      .map((t) => ({
        id: `wi-${t.taskId}`,
        taskId: t.taskId,
        title: t.title,
        prompt: "p",
        requiredFilesHint: [],
        expectedOutput: [],
        testCommands: [],
        forbiddenPaths: [],
        blocked: false,
        blockers: [],
        qualityGate: { score: 1, promptReady: true, missing: [] },
      }));
    let executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    executionState = markDeveloperTasksDoneForWip({ state: executionState, cursorWorkItems: workItems, nowIso: NOW });
    executionState = markPostDeveloperReviewTasksQueued({ state: executionState, nowIso: NOW });
    executionState = markRoleTasksDone({ state: executionState, ownerRole: "reviewer", nowIso: NOW });
    executionState = markRoleTasksDone({ state: executionState, ownerRole: "security", nowIso: NOW });
    executionState = markRoleTasksDone({ state: executionState, ownerRole: "scm", nowIso: NOW });
    return {
      projectId: "p1",
      taskList,
      executionState,
      previewReady: false,
    };
  }

  it("task rows complete + refactor_common ready -> RUN_REFACTOR_COMMON", () => {
    const actions = deriveImplementationStageNextActions(
      "task_list_ready",
      completedBoardInput().executionState,
      null,
      completedBoardInput(),
    );
    expect(actions[0]?.actionId).toBe("RUN_REFACTOR_COMMON");
    expect(actions[0]?.label).toBe(RUN_REFACTOR_COMMON_CHIP);
  });

  it("refactor_common done -> RUN_INTEGRATED_REVIEW", () => {
    const input = completedBoardInput();
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    integrated = markIntegratedStepInProgress({
      state: integrated,
      projectId: "p1",
      step: "refactor_common",
      nowIso: NOW,
    });
    integrated = markIntegratedStepDone({
      state: integrated,
      projectId: "p1",
      step: "refactor_common",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    const actions = deriveImplementationStageNextActions("task_list_ready", input.executionState, null, {
      ...input,
      integratedExecutionState: integrated,
    });
    expect(actions[0]?.actionId).toBe("RUN_INTEGRATED_REVIEW");
    expect(actions[0]?.label).toBe(RUN_INTEGRATED_REVIEW_CHIP);
  });

  it("integrated_review done -> RUN_INTEGRATED_SECURITY", () => {
    const input = completedBoardInput();
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    integrated = markIntegratedStepInProgress({
      state: integrated,
      projectId: "p1",
      step: "refactor_common",
      nowIso: NOW,
    });
    integrated = markIntegratedStepDone({
      state: integrated,
      projectId: "p1",
      step: "refactor_common",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    integrated = markIntegratedStepInProgress({
      state: integrated,
      projectId: "p1",
      step: "integrated_review",
      nowIso: NOW,
    });
    integrated = markIntegratedStepDone({
      state: integrated,
      projectId: "p1",
      step: "integrated_review",
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    const actions = deriveImplementationStageNextActions("task_list_ready", input.executionState, null, {
      ...input,
      integratedExecutionState: integrated,
    });
    expect(actions[0]?.actionId).toBe("RUN_INTEGRATED_SECURITY");
    expect(actions[0]?.label).toBe(RUN_INTEGRATED_SECURITY_CHIP);
  });

  it("integrated_security done -> RUN_FINAL_SCM", () => {
    const input = completedBoardInput();
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    for (const step of ["refactor_common", "integrated_review", "integrated_security"] as const) {
      integrated = markIntegratedStepInProgress({
        state: integrated,
        projectId: "p1",
        step,
        nowIso: NOW,
      });
      integrated = markIntegratedStepDone({
        state: integrated,
        projectId: "p1",
        step,
        taskRowsCompleted: true,
        nowIso: NOW,
      });
    }
    const actions = deriveImplementationStageNextActions("task_list_ready", input.executionState, null, {
      ...input,
      integratedExecutionState: integrated,
    });
    expect(actions[0]?.actionId).toBe("RUN_FINAL_SCM");
    expect(actions[0]?.label).toBe(RUN_FINAL_SCM_CHIP);
  });
});

describe("prioritizeImplementationChipsByNextActions", () => {
  it("sorts chips by primary/secondary next actions", () => {
    const nextActions = deriveImplementationStageNextActions("work_plan_drafted");
    const sorted = prioritizeImplementationChipsByNextActions({
      labels: ["산출물 다시 보기", "구현 범위 수정", "구현 작업안 확정"],
      nextActions,
    });
    expect(sorted).toEqual(["구현 작업안 확정", "구현 범위 수정", "산출물 다시 보기"]);
  });

  it("keeps unknown chips after prioritized chips in original order", () => {
    const nextActions = deriveImplementationStageNextActions("implementation_ready");
    const sorted = prioritizeImplementationChipsByNextActions({
      labels: ["알 수 없는 칩", "구현 작업안 초안 생성", "다른 칩"],
      nextActions,
    });
    expect(sorted[0]).toBe("구현 작업안 초안 생성");
    expect(sorted.slice(1)).toEqual(["알 수 없는 칩", "다른 칩"]);
  });

  it("preserves order among chips with equal priority", () => {
    const sorted = prioritizeImplementationChipsByNextActions({
      labels: ["B", "A"],
      nextActions: [],
    });
    expect(sorted).toEqual(["B", "A"]);
  });
});

