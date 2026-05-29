import { describe, expect, it } from "vitest";
import {
  buildImplementationStageActionExecutionDecision,
  buildImplementationStageActionOpenArtifactsResult,
  buildImplementationStageActionOpenEnvSettingsResult,
  buildImplementationStageActionShowStatusResult,
  buildImplementationStageBoardGateContext,
  buildStageActionRunCompletionTimelineEntries,
  evaluateImplementationStageActionGate,
  IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE,
  isImplementationSeedReadyForWorkPlanGeneration,
  stageActionExecutionResultFromGate,
  stageActionRunResultToTimelinePhase,
} from "@/lib/prototype/implementationStageActionPipeline";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksDoneForWip,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksDone,
} from "@/lib/prototype/implementationTaskExecutionState";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { defaultImplementationDbStrategy } from "@/lib/prototype/implementationDbStrategy";
import type { ImplementationTaskPlanV1 } from "@/lib/prototype/implementationTaskPlan";
import type { ImplementationWorkPlanDraftV1 } from "@/lib/prototype/implementationWorkPlanDraft";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

function makeDraft(updatedAt: string): ImplementationWorkPlanDraftV1 {
  return {
    version: "implementation_work_plan_draft_v1",
    projectId: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt,
    source: "planning_artifacts",
    referenceArtifacts: [],
    implementationScope: ["scope"],
    implementationApproach: [],
    assumptions: [],
    blockers: [],
    status: "draft",
  };
}

function makeTaskPlan(createdAt: string): ImplementationTaskPlanV1 {
  return {
    version: "implementation_task_plan_v1",
    projectId: "p1",
    createdAt,
    source: "implementation_orchestration",
    items: [],
    readiness: { ready: true, missing: [] },
  };
}

function makeSeed(
  lifecycleStatus: ImplementationSeedV1["lifecycleStatus"],
  ready: boolean,
): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    source: "planning_slots_and_artifacts",
    lifecycleStatus,
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

function makeTaskListReady(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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

function baseState(
  overrides: {
    readonly parsedRequirementsState?: {
      readonly implementationSeedV1?: ImplementationSeedV1 | null;
      readonly implementationTaskListV1?: ImplementationTaskListV1 | null;
      readonly implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null;
      readonly implementationTaskPlanV1?: ImplementationTaskPlanV1 | null;
      readonly implementationDbStrategyV1?: ReturnType<typeof defaultImplementationDbStrategy> | null;
    };
    readonly pendingPatch?: { readonly implementationWorkPlanDraftV1?: ImplementationWorkPlanDraftV1 | null };
    readonly envOk?: boolean;
    readonly designOk?: boolean;
  } = {},
) {
  return resolveEffectiveImplementationState({
    parsedRequirementsState: {
      implementationSeedV1: null,
      implementationTaskListV1: null,
      implementationWorkPlanDraftV1: null,
      implementationTaskPlanV1: null,
      implementationDbStrategyV1: null,
      ...overrides.parsedRequirementsState,
    },
    pendingPatch: overrides.pendingPatch ?? {},
    envOk: overrides.envOk ?? true,
    designOk: overrides.designOk ?? true,
  });
}

describe("isImplementationSeedReadyForWorkPlanGeneration", () => {
  it("allows confirmed seed with readiness.ready", () => {
    expect(isImplementationSeedReadyForWorkPlanGeneration(makeSeed("confirmed", true))).toBe(true);
  });

  it("blocks candidate seed even when readiness.ready", () => {
    expect(isImplementationSeedReadyForWorkPlanGeneration(makeSeed("candidate", true))).toBe(false);
  });
});

describe("evaluateImplementationStageActionGate", () => {
  describe("GENERATE_IMPLEMENTATION_WORK_PLAN", () => {
    it("allows when designOk is false but seed/env are ready", () => {
      const state = baseState({
        parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
        designOk: false,
      });
      expect(evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(true);
    });

    it("blocks when envOk is false", () => {
      const state = baseState({
        parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
        envOk: false,
      });
      expect(evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(false);
    });

    it("blocks candidate seed with policy A message", () => {
      const state = baseState({
        parsedRequirementsState: { implementationSeedV1: makeSeed("candidate", true) },
      });
      const gate = evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state);
      expect(gate.ok).toBe(false);
      if (!gate.ok) {
        expect(gate.message).toBe(IMPLEMENTATION_WORK_PLAN_SEED_GATE_BLOCKED_MESSAGE);
      }
    });

    it("allows confirmed ready seed with design and env ok", () => {
      const state = baseState({
        parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
      });
      expect(evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(true);
    });
  });

  describe("CONFIRM_IMPLEMENTATION_WORK_PLAN", () => {
    it("allows pending draft when designOk is true", () => {
      const pending = makeDraft("pending");
      const state = baseState({
        parsedRequirementsState: { implementationWorkPlanDraftV1: null },
        pendingPatch: { implementationWorkPlanDraftV1: pending },
      });
      expect(evaluateImplementationStageActionGate("CONFIRM_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(true);
    });

    it("blocks when designOk is false", () => {
      const state = baseState({
        parsedRequirementsState: { implementationWorkPlanDraftV1: makeDraft("d") },
        designOk: false,
      });
      expect(evaluateImplementationStageActionGate("CONFIRM_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(false);
    });
  });

  describe("REVIEW_DB_INTEGRATION", () => {
    it("allows when task plan exists", () => {
      const state = baseState({
        parsedRequirementsState: {
          implementationSeedV1: makeSeed("confirmed", true),
          implementationTaskPlanV1: makeTaskPlan("2026-01-02T00:00:00.000Z"),
        },
      });
      expect(evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", state).ok).toBe(true);
    });

    it("allows when work plan draft exists", () => {
      const state = baseState({
        parsedRequirementsState: {
          implementationSeedV1: makeSeed("confirmed", true),
          implementationWorkPlanDraftV1: makeDraft("draft"),
        },
      });
      expect(evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", state).ok).toBe(true);
    });

    it("allows when seed/env are ready even if draft and task plan are missing (auto-progress)", () => {
      const state = baseState({
        parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
      });
      expect(evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", state).ok).toBe(true);
    });
  });

  describe("GENERATE_DATA_MODEL_DRAFT", () => {
    it("allows when dbDecisionRequested is true", () => {
      const state = baseState({
        parsedRequirementsState: {
          implementationSeedV1: makeSeed("confirmed", true),
          implementationDbStrategyV1: { ...defaultImplementationDbStrategy("2026-01-01T00:00:00.000Z"), dbDecisionRequested: true },
        },
      });
      expect(evaluateImplementationStageActionGate("GENERATE_DATA_MODEL_DRAFT", state).ok).toBe(true);
    });

    it("blocks without task plan or db decision", () => {
      expect(evaluateImplementationStageActionGate("GENERATE_DATA_MODEL_DRAFT", baseState()).ok).toBe(false);
    });
  });

  describe("CONFIRM_MOCK_IMPLEMENTATION", () => {
    it("allows when task plan exists", () => {
      const state = baseState({
        parsedRequirementsState: {
          implementationSeedV1: makeSeed("confirmed", true),
          implementationTaskPlanV1: makeTaskPlan("2026-01-02T00:00:00.000Z"),
        },
      });
      expect(evaluateImplementationStageActionGate("CONFIRM_MOCK_IMPLEMENTATION", state).ok).toBe(true);
    });

    it("allows when seed/env are ready even if draft and task plan are missing (auto-progress)", () => {
      const state = baseState({
        parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
      });
      expect(evaluateImplementationStageActionGate("CONFIRM_MOCK_IMPLEMENTATION", state).ok).toBe(true);
    });
  });

  describe("REQUEST_CODE_AGENT_WIP", () => {
    it("blocks without task plan and without task list", () => {
      const gate = evaluateImplementationStageActionGate("REQUEST_CODE_AGENT_WIP", baseState());
      expect(gate.ok).toBe(false);
      if (!gate.ok) {
        expect(gate.message).toContain("구현 작업목록");
      }
    });

    it("allows when task list is ready even if task plan is missing", () => {
      const state = baseState({
        parsedRequirementsState: {
          implementationSeedV1: makeSeed("confirmed", true),
          implementationTaskListV1: makeTaskListReady(),
        },
      });
      expect(evaluateImplementationStageActionGate("REQUEST_CODE_AGENT_WIP", state).ok).toBe(true);
    });

    it("blocks when envOk is false", () => {
      const state = baseState({
        parsedRequirementsState: { implementationTaskPlanV1: makeTaskPlan("2026-01-02T00:00:00.000Z") },
        envOk: false,
      });
      expect(evaluateImplementationStageActionGate("REQUEST_CODE_AGENT_WIP", state).ok).toBe(false);
    });

    it("allows when task plan and envOk are set", () => {
      const state = baseState({
        parsedRequirementsState: { implementationTaskPlanV1: makeTaskPlan("2026-01-02T00:00:00.000Z") },
      });
      expect(evaluateImplementationStageActionGate("REQUEST_CODE_AGENT_WIP", state).ok).toBe(true);
    });
  });

  describe("always allowed actions", () => {
    const alwaysAllowed = [
      "OPEN_ENV_SETTINGS",
      "SHOW_ARTIFACTS",
      "SHOW_ROLE_CHECK",
      "SHOW_SCM_CHECK",
      "SHOW_ENV_CHECK",
      "EDIT_IMPLEMENTATION_SCOPE",
    ] as const;

    it.each(alwaysAllowed)("allows %s", (actionId) => {
      expect(evaluateImplementationStageActionGate(actionId, baseState()).ok).toBe(true);
    });
  });

  describe("integrated stage actions", () => {
    const NOW = "2026-05-28T12:00:00.000Z";
    const workItems: readonly CursorWorkItem[] = [
      {
        id: "wi-1",
        taskId: "DEV-001",
        title: "t",
        prompt: "p",
        requiredFilesHint: [],
        expectedOutput: [],
        testCommands: [],
        forbiddenPaths: [],
        blocked: false,
        blockers: [],
        qualityGate: { score: 1, promptReady: true, missing: [] },
      },
    ];

    function boardContextWithAllTasksComplete() {
      const taskList = makeTaskListReady();
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
      executionState = markRoleTasksDone({ state: executionState, ownerRole: "reviewer", nowIso: NOW });
      executionState = markRoleTasksDone({ state: executionState, ownerRole: "security", nowIso: NOW });
      executionState = markRoleTasksDone({ state: executionState, ownerRole: "scm", nowIso: NOW });
      return buildImplementationStageBoardGateContext({
        projectId: "p1",
        taskList,
        executionState,
        previewReady: true,
      });
    }

    it("allows RUN_REFACTOR_COMMON when all task rows completed", () => {
      const state = baseState({
        parsedRequirementsState: {
          implementationSeedV1: makeSeed("confirmed", true),
          implementationTaskListV1: makeTaskListReady(),
        },
      });
      const boardContext = boardContextWithAllTasksComplete();
      expect(
        evaluateImplementationStageActionGate("RUN_REFACTOR_COMMON", state, boardContext).ok,
      ).toBe(true);
    });

    it("blocks RUN_INTEGRATED_REVIEW until refactor_common done", () => {
      const state = baseState({
        parsedRequirementsState: {
          implementationSeedV1: makeSeed("confirmed", true),
          implementationTaskListV1: makeTaskListReady(),
        },
      });
      const boardContext = boardContextWithAllTasksComplete();
      expect(
        evaluateImplementationStageActionGate("RUN_INTEGRATED_REVIEW", state, boardContext).ok,
      ).toBe(false);
    });
  });

  describe("quality gate run actions", () => {
    it("allows RUN_REVIEWER_CHECK when task list is ready", () => {
      const state = baseState({
        parsedRequirementsState: {
          implementationSeedV1: makeSeed("confirmed", true),
          implementationTaskListV1: makeTaskListReady(),
        },
      });
      expect(evaluateImplementationStageActionGate("RUN_REVIEWER_CHECK", state).ok).toBe(true);
      expect(evaluateImplementationStageActionGate("RUN_SECURITY_CHECK", state).ok).toBe(true);
    });

    it("blocks RUN_REVIEWER_CHECK when task list is missing", () => {
      expect(evaluateImplementationStageActionGate("RUN_REVIEWER_CHECK", baseState()).ok).toBe(false);
    });
  });
});

describe("buildImplementationStageActionExecutionDecision", () => {
  it("returns blocked result when gate fails", () => {
    const state = baseState({
      parsedRequirementsState: { implementationSeedV1: makeSeed("candidate", true) },
    });
    const result = buildImplementationStageActionExecutionDecision(
      "GENERATE_IMPLEMENTATION_WORK_PLAN",
      state,
    );
    expect(result?.kind).toBe("blocked");
    expect(result?.timelineEntries?.[0]?.action).toBe("implementation_stage_action_routed");
    expect(result?.timelineEntries?.[1]?.action).toBe("implementation_stage_action_blocked");
  });

  it("returns null when gate passes", () => {
    const state = baseState({
      parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
    });
    expect(
      buildImplementationStageActionExecutionDecision("GENERATE_IMPLEMENTATION_WORK_PLAN", state),
    ).toBeNull();
  });
});

describe("stageActionExecutionResultFromGate", () => {
  it("returns blocked result with timeline when actionId provided", () => {
    const gate = evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", baseState());
    const result = stageActionExecutionResultFromGate(gate, {
      actionId: "REVIEW_DB_INTEGRATION",
    });
    expect(result?.kind).toBe("blocked");
    expect(result?.timelineEntries?.[0]?.responseText).toContain("REVIEW_DB_INTEGRATION");
  });

  it("returns null when gate passes", () => {
    const state = baseState({
      parsedRequirementsState: {
        implementationSeedV1: makeSeed("confirmed", true),
        implementationWorkPlanDraftV1: makeDraft("d"),
      },
    });
    const gate = evaluateImplementationStageActionGate("REVIEW_DB_INTEGRATION", state);
    expect(stageActionExecutionResultFromGate(gate)).toBeNull();
  });
});

describe("work plan generation gate readiness alignment", () => {
  it("allows work plan generation when seed is confirmed and ready even if designOk is false", () => {
    const state = baseState({
      envOk: true,
      designOk: false,
      parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
    });
    expect(evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state)).toEqual({ ok: true });
  });

  it("blocks work plan generation when env is not ready", () => {
    const state = baseState({
      envOk: false,
      designOk: false,
      parsedRequirementsState: { implementationSeedV1: makeSeed("confirmed", true) },
    });
    expect(evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state)).toMatchObject({
      ok: false,
      message: "환경 준비가 완료된 뒤 작업안을 생성할 수 있습니다.",
    });
  });

  it("blocks work plan generation when seed is candidate", () => {
    const state = baseState({
      envOk: true,
      designOk: false,
      parsedRequirementsState: { implementationSeedV1: makeSeed("candidate", true) },
    });
    expect(evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(false);
  });

  it("blocks work plan generation when implementation seed is missing", () => {
    const state = baseState({
      envOk: true,
      designOk: false,
      parsedRequirementsState: { implementationSeedV1: null },
    });
    expect(evaluateImplementationStageActionGate("GENERATE_IMPLEMENTATION_WORK_PLAN", state).ok).toBe(false);
  });
});

describe("result factory kinds", () => {
  it("returns expected kinds for modal/status actions", () => {
    expect(buildImplementationStageActionOpenEnvSettingsResult().kind).toBe("open_env_settings");
    expect(buildImplementationStageActionOpenArtifactsResult().kind).toBe("open_artifacts");
    expect(buildImplementationStageActionShowStatusResult("env").intent).toBe("env");
  });
});

describe("stageActionRunResultToTimelinePhase", () => {
  it("maps run outcomes to executed or blocked timeline phase", () => {
    expect(stageActionRunResultToTimelinePhase({ outcome: "executed" })).toBe("executed");
    expect(stageActionRunResultToTimelinePhase({ outcome: "blocked", message: "x" })).toBe("blocked");
    expect(stageActionRunResultToTimelinePhase({ outcome: "no_op", message: "x" })).toBe("blocked");
  });
});

describe("buildStageActionRunCompletionTimelineEntries", () => {
  it("returns routed + executed for successful run", () => {
    const entries = buildStageActionRunCompletionTimelineEntries("SHOW_ARTIFACTS", {
      outcome: "executed",
    }, "cta", "run-1");
    expect(entries.map((e) => e.action)).toEqual([
      "implementation_stage_action_routed",
      "implementation_stage_action_executed",
    ]);
    expect(entries[0]?.responseText).toContain("runId=run-1");
    expect(entries[1]?.responseText).toContain("runId=run-1");
  });

  it("returns routed + blocked for no_op run", () => {
    const entries = buildStageActionRunCompletionTimelineEntries("GENERATE_IMPLEMENTATION_WORK_PLAN", {
      outcome: "no_op",
      message: "already_exists",
    }, "cta", "run-2");
    expect(entries.map((e) => e.action)).toEqual([
      "implementation_stage_action_routed",
      "implementation_stage_action_blocked",
    ]);
    expect(entries[1]?.responseText).toContain("already_exists");
    expect(entries[0]?.responseText).toContain("runId=run-2");
    expect(entries[1]?.responseText).toContain("runId=run-2");
  });
});
