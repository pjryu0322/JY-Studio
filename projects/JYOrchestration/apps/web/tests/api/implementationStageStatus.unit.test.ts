import { describe, expect, it } from "vitest";
import { deriveImplementationStageStatus } from "@/lib/prototype/implementationStageStatus";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksInProgress,
  summarizeImplementationTaskExecutionItems,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  syncImplementationTaskExecutionFromPrototypeRun,
  deriveImplementationPrototypeRunSyncSnapshot,
} from "@/lib/prototype/implementationPrototypeRunSync";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";

const NOW = "2026-01-01T00:00:00.000Z";

function makeSeed(ready: boolean): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_slots_and_artifacts",
    lifecycleStatus: "confirmed",
    readiness: { ready, missing: [], warnings: [] },
    processImplementationItems: [],
    screenImplementationItems: [],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [],
    dataModelSeed: { entities: [], relationships: [] },
    assumptions: [],
    gaps: [],
  };
}

function makeDraft(): ImplementationWorkPlanDraftV1 {
  return {
    version: "implementation_work_plan_draft_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_artifacts",
    referenceArtifacts: [],
    implementationScope: ["scope"],
    implementationApproach: [],
    assumptions: [],
    blockers: [],
    status: "draft",
  };
}

function makeTaskPlan(): ImplementationTaskPlanV1 {
  return {
    version: "implementation_task_plan_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    implementationScope: ["scope"],
    workUnits: [],
    status: "confirmed",
  };
}

function makeTaskListReady(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "DEV-001",
        title: "개발 작업",
        description: "dev",
        taskType: "feature",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
      {
        taskId: "REV-001",
        title: "검수 작업",
        description: "rev",
        taskType: "validation",
        ownerRole: "reviewer",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
      {
        taskId: "SEC-001",
        title: "보안 작업",
        description: "sec",
        taskType: "security",
        ownerRole: "security",
        priority: "medium",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
      {
        taskId: "SCM-001",
        title: "SCM 작업",
        description: "scm",
        taskType: "scm",
        ownerRole: "scm",
        priority: "low",
        dependencies: [],
        acceptanceCriteria: ["ok"],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 1, security: 1, scm: 1 },
  };
}

describe("deriveImplementationStageStatus", () => {
  it("returns not_ready when design, env, or seed readiness is missing", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationSeedV1: makeSeed(false) },
      pendingPatch: {},
      envOk: false,
      designOk: true,
    });
    expect(deriveImplementationStageStatus(state)).toBe("not_ready");
  });

  it("returns implementation_ready when seed is ready and env ok even if designOk is false", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: { implementationSeedV1: makeSeed(true) },
      pendingPatch: {},
      envOk: true,
      designOk: false,
    });
    expect(deriveImplementationStageStatus(state)).toBe("implementation_ready");
  });

  it("returns task_list_ready when seed and task list are ready (no draft/task plan)", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: makeSeed(true),
        implementationTaskListV1: makeTaskListReady(),
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });
    expect(deriveImplementationStageStatus(state)).toBe("task_list_ready");
  });

  it("returns work_plan_drafted when draft exists", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: makeSeed(true),
        implementationTaskListV1: makeTaskListReady(),
        implementationWorkPlanDraftV1: makeDraft(),
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });
    expect(deriveImplementationStageStatus(state)).toBe("work_plan_drafted");
  });

  it("returns work_plan_confirmed when task plan exists", () => {
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: makeSeed(true),
        implementationTaskListV1: makeTaskListReady(),
        implementationWorkPlanDraftV1: makeDraft(),
        implementationTaskPlanV1: makeTaskPlan(),
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
    });
    expect(deriveImplementationStageStatus(state)).toBe("work_plan_confirmed");
  });

  it("returns prototype_ready when preview is ready and scm tasks are done", () => {
    const taskList = makeTaskListReady();
    let executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    executionState = {
      ...executionState,
      items: executionState.items.map((item) =>
        item.ownerRole === "developer" ? { ...item, status: "done" as const, completedAt: NOW } : item,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        executionState.items.map((item) =>
          item.ownerRole === "developer" ? { ...item, status: "done" as const, completedAt: NOW } : item,
        ),
      ),
    };
    executionState = markPostDeveloperReviewTasksQueued({ state: executionState, nowIso: NOW });
    executionState = markRoleTasksInProgress({ state: executionState, ownerRole: "scm", nowIso: NOW });
    const latestRun = {
      id: "run-1",
      status: "PREVIEW_READY",
      previewUrl: "https://preview.example/app",
      workUnits: [],
    };
    const snapshot = deriveImplementationPrototypeRunSyncSnapshot({ latestRun });
    executionState =
      syncImplementationTaskExecutionFromPrototypeRun({ state: executionState, snapshot, nowIso: NOW })!;

    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: makeSeed(true),
        implementationTaskListV1: taskList,
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
      latestRun: latestRun as never,
    });
    expect(deriveImplementationStageStatus(state, executionState)).toBe("prototype_ready");
  });

  it("returns prototype_ready over work_plan_confirmed when preview is complete", () => {
    const taskList = makeTaskListReady();
    let executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    executionState = {
      ...executionState,
      items: executionState.items.map((item) =>
        item.ownerRole === "developer" || item.ownerRole === "scm"
          ? { ...item, status: "done" as const, completedAt: NOW }
          : item,
      ),
      summary: summarizeImplementationTaskExecutionItems(
        executionState.items.map((item) =>
          item.ownerRole === "developer" || item.ownerRole === "scm"
            ? { ...item, status: "done" as const, completedAt: NOW }
            : item,
        ),
      ),
    };
    const latestRun = {
      id: "run-1",
      status: "PREVIEW_READY",
      previewUrl: "https://preview.example/app",
      workUnits: [],
    };
    const state = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: makeSeed(true),
        implementationTaskListV1: taskList,
        implementationWorkPlanDraftV1: makeDraft(),
        implementationTaskPlanV1: makeTaskPlan(),
      },
      pendingPatch: {},
      envOk: true,
      designOk: true,
      latestRun: latestRun as never,
    });
    expect(deriveImplementationStageStatus(state, executionState)).toBe("prototype_ready");
    expect(deriveImplementationStageStatus(state, executionState)).not.toBe("work_plan_confirmed");
  });
});
