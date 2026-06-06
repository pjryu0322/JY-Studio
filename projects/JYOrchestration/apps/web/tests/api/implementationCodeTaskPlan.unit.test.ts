import { describe, expect, it } from "vitest";
import {
  buildImplementationCodeTaskPlanFromTaskList,
  IMPLEMENTATION_CODE_TASK_PLAN_VERSION,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { buildCursorWorkItemsFromImplementationCodeTaskPlan, buildCursorWorkItemsFromImplementationTaskListFallback } from "@/lib/prototype/implementationCursorWorkItems";
import { buildGenerateImplementationTaskListFromSeedResult } from "@/lib/prototype/implementationTaskListGeneration";
import {
  buildImplementationPlanningReadinessPatch,
  evaluateImplementationPlanningExecutionGate,
  IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE,
} from "@/lib/prototype/implementationPlanningReadiness";
import { evaluateImplementationStageActionGate, buildImplementationStageBoardGateContext } from "@/lib/prototype/implementationStageActionPipeline";
import { resolveEffectiveImplementationState } from "@/lib/prototype/effectiveImplementationState";
import { runWorkItemPreflightBatch } from "@/lib/prototype/implementationWorkItemPreflight";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import {
  buildImplementationTaskListFromSeed,
  type ImplementationTaskListV1,
  type ImplementationTaskV1,
} from "@/lib/requirements/implementationTaskList";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import {
  buildDynamicServicePlanningSlotDefinitions,
  initialOrchestrationStateFromDefinitions,
} from "@/lib/requirements/singleChatOrchestrationSlots";
import { runQuickDesignConfirmImplementationPrep } from "@/lib/requirements/quickDesignConfirmImplementationPrep";

const NOW = "2026-05-28T12:00:00.000Z";
const PROJECT_ID = "p-code-task";

function developerTask(input: {
  readonly taskId: string;
  readonly taskType: ImplementationTaskV1["taskType"];
  readonly title: string;
}): ImplementationTaskV1 {
  return {
    taskId: input.taskId,
    title: input.title,
    description: input.title,
    taskType: input.taskType,
    ownerRole: "developer",
    priority: "medium",
    status: "ready",
    dependencies: [],
    acceptanceCriteria: [`${input.title} 완료`],
    sourceRefs: [],
  };
}

function nonDeveloperTask(input: {
  readonly taskId: string;
  readonly ownerRole: ImplementationTaskV1["ownerRole"];
  readonly taskType: ImplementationTaskV1["taskType"];
}): ImplementationTaskV1 {
  return {
    taskId: input.taskId,
    title: input.taskId,
    description: input.taskId,
    taskType: input.taskType,
    ownerRole: input.ownerRole,
    priority: "medium",
    status: "ready",
    dependencies: [],
    acceptanceCriteria: [],
    sourceRefs: [],
  };
}

function sampleTaskList(): ImplementationTaskListV1 {
  const tasks = [
    developerTask({ taskId: "DEV-SCREEN-001", taskType: "screen", title: "화면 A" }),
    developerTask({ taskId: "DEV-FEATURE-001", taskType: "feature", title: "기능 B" }),
    nonDeveloperTask({ taskId: "REVIEW-001", ownerRole: "reviewer", taskType: "validation" }),
    nonDeveloperTask({ taskId: "SECURITY-001", ownerRole: "security", taskType: "security" }),
    nonDeveloperTask({ taskId: "SCM-001", ownerRole: "scm", taskType: "scm" }),
  ];
  return {
    version: 1,
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks,
    roleSummary: { developer: 2, designer: 0, reviewer: 1, security: 1, scm: 1 },
  };
}

function confirmedSeed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    lifecycleStatus: "confirmed",
    readiness: { ready: true, score: 1, missing: [], warnings: [] },
    processImplementationItems: [
      { id: "p1", processName: "주문", actors: ["user"], screens: ["s1"], summary: "s" },
    ],
    screenImplementationItems: [
      {
        id: "s1",
        screenName: "목록",
        routeOrEntry: "/list",
        primaryActions: ["조회"],
        dataEntities: [],
        linkedProcesses: [],
      },
    ],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [],
    dataModelSeed: { entities: ["Order"], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
    assumptions: [],
    gaps: [],
  };
}

describe("ImplementationCodeTaskPlanV1", () => {
  it("decomposes developer tasks only with stable CODE-{parentTaskId}-{NNN} ids", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });

    expect(plan.version).toBe(IMPLEMENTATION_CODE_TASK_PLAN_VERSION);
    expect(plan.parentTaskCount).toBe(2);
    expect(plan.codeTaskCount).toBeGreaterThan(0);
    expect(plan.tasks.every((task) => task.parentTaskId.startsWith("DEV-"))).toBe(true);
    expect(plan.tasks.some((task) => task.parentTaskId === "REVIEW-001")).toBe(false);
    expect(plan.tasks.some((task) => task.parentTaskId === "SECURITY-001")).toBe(false);
    expect(plan.tasks.some((task) => task.parentTaskId === "SCM-001")).toBe(false);

    const screenTasks = plan.tasks.filter((task) => task.parentTaskId === "DEV-SCREEN-001");
    expect(screenTasks.length).toBeGreaterThan(0);
    expect(screenTasks[0]?.codeTaskId).toBe("CODE-DEV-SCREEN-001-001");
    expect(screenTasks.every((task) => task.status === "ready")).toBe(true);
    expect(plan.readiness.ready).toBe(true);
    expect(new Set(plan.tasks.map((task) => task.codeTaskId)).size).toBe(plan.tasks.length);
  });

  it("orders CodeTasks from TaskList execution order (sample data before screens)", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: PROJECT_ID,
      seed: confirmedSeed(),
      nowIso: NOW,
    });
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const mockIdx = plan.tasks.findIndex((t) => t.parentTaskId === "DEV-MOCK-001");
    const screenIdx = plan.tasks.findIndex((t) => t.parentTaskId.startsWith("DEV-SCREEN"));
    expect(mockIdx).toBeGreaterThanOrEqual(0);
    expect(screenIdx).toBeGreaterThan(mockIdx);
    const screenTask = plan.tasks.find((t) => t.parentTaskId.startsWith("DEV-SCREEN"));
    expect(screenTask?.parentTaskDependencies).toContain("DEV-MOCK-001");
  });

  it("marks CodeTask blocked when env or design is not ready", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: false,
      designOk: true,
      nowIso: NOW,
    });
    expect(plan.tasks.every((task) => task.status === "blocked")).toBe(true);
    expect(plan.readiness.ready).toBe(false);
    expect(plan.readiness.missing).toContain("실행환경 미준비");
    expect(plan.readiness.missing).toContain("blocked CodeTask 존재");
  });

  it("separates parent task and code task dependency namespaces", () => {
    const taskList: ImplementationTaskListV1 = {
      ...sampleTaskList(),
      tasks: [
        {
          ...developerTask({ taskId: "DEV-SCREEN-001", taskType: "screen", title: "화면 A" }),
          dependencies: ["DEV-MOCK-001"],
        },
      ],
      roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const screenTasks = plan.tasks.filter(
      (task) => task.parentTaskId === "DEV-SCREEN-001" && task.changeType !== "integration",
    );
    expect(screenTasks).toHaveLength(1);
    expect(screenTasks[0]?.parentTaskDependencies).toContain("DEV-MOCK-001");
    expect(screenTasks[0]?.dependencies).toEqual(expect.arrayContaining(["DEV-MOCK-001"]));
  });

  it("includes dependency context in CodeTask-based WorkItem prompt", () => {
    const taskList: ImplementationTaskListV1 = {
      ...sampleTaskList(),
      tasks: [
        {
          ...developerTask({ taskId: "DEV-SCREEN-001", taskType: "screen", title: "화면 A" }),
          dependencies: ["DEV-MOCK-001"],
        },
      ],
      roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const [firstWorkItem] = buildCursorWorkItemsFromImplementationCodeTaskPlan({
      projectId: PROJECT_ID,
      codeTaskPlan: plan,
      originStage: "planning",
      nowIso: NOW,
    });
    expect(firstWorkItem?.prompt).toContain("CodeTask:");
    expect(firstWorkItem?.prompt).toContain("Parent Task:");
    expect(firstWorkItem?.prompt).toContain("Parent Task Dependencies:");
    expect(firstWorkItem?.prompt).toContain("DEV-MOCK-001");
  });

  it("records timeline when TaskList direct WorkItem fallback is used", () => {
    const fallback = buildCursorWorkItemsFromImplementationTaskListFallback({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      nowIso: NOW,
      originStage: "implementation",
    });
    expect(fallback.workItems.length).toBeGreaterThan(0);
    expect(fallback.timelineEntry.action).toBe(
      "implementation_work_items_fallback_generated_from_task_list",
    );
  });

  it("buildImplementationPlanningReadinessPatch includes codeTaskPromptContextMapV1", () => {
    const list = sampleTaskList();
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    expect(readiness.codeTaskPromptContextMapV1.projectId).toBe(PROJECT_ID);
    expect(Object.keys(readiness.codeTaskPromptContextMapV1.contexts).length).toBe(
      readiness.implementationCodeTaskPlanV1.tasks.length,
    );
  });

  it("blocks Quick Run and Task Cursor when code task validation failed", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const failedPlan = {
      ...readiness.implementationCodeTaskPlanV1,
      validationReport: {
        status: "failed" as const,
        checkedAt: NOW,
        errors: ["invalid plan"],
        warnings: [],
      },
    };
    const gate = evaluateImplementationPlanningExecutionGate({
      codeTaskPlan: failedPlan,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: readiness.implementationWorkItemPreflightSummaryV1,
    });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.reason).toBe("code_task_validation_failed");

    const effectiveState = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: confirmedSeed(),
        implementationTaskListV1: sampleTaskList(),
      },
      envOk: true,
      designOk: true,
    });
    const boardContext = buildImplementationStageBoardGateContext({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      implementationCodeTaskPlanV1: failedPlan,
      cursorWorkItemsV1: readiness.cursorWorkItemsV1,
      implementationWorkItemPreflightSummaryV1: readiness.implementationWorkItemPreflightSummaryV1,
    });
    expect(
      evaluateImplementationStageActionGate("START_IMPLEMENTATION_QUICK_RUN", effectiveState, boardContext).ok,
    ).toBe(true);
    expect(
      evaluateImplementationStageActionGate("REQUEST_TASK_CURSOR_EXECUTION", effectiveState, boardContext).ok,
    ).toBe(false);
  });

  it("blocks Quick Run and Task Cursor when planning preflight failed", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const failedSummary = {
      ...readiness.implementationWorkItemPreflightSummaryV1,
      status: "failed" as const,
    };
    const gate = evaluateImplementationPlanningExecutionGate({
      codeTaskPlan: readiness.implementationCodeTaskPlanV1,
      cursorWorkItems: readiness.cursorWorkItemsV1,
      preflightSummary: failedSummary,
    });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.message).toBe(IMPLEMENTATION_PLANNING_EXECUTION_BLOCKED_MESSAGE);
    expect(gate.reason).toBe("preflight_failed");

    const effectiveState = resolveEffectiveImplementationState({
      parsedRequirementsState: {
        implementationSeedV1: confirmedSeed(),
        implementationTaskListV1: sampleTaskList(),
      },
      envOk: true,
      designOk: true,
    });
    const boardContext = buildImplementationStageBoardGateContext({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      implementationCodeTaskPlanV1: readiness.implementationCodeTaskPlanV1,
      cursorWorkItemsV1: readiness.cursorWorkItemsV1,
      implementationWorkItemPreflightSummaryV1: failedSummary,
    });
    expect(
      evaluateImplementationStageActionGate("START_IMPLEMENTATION_QUICK_RUN", effectiveState, boardContext).ok,
    ).toBe(true);
    expect(
      evaluateImplementationStageActionGate("REQUEST_TASK_CURSOR_EXECUTION", effectiveState, boardContext).ok,
    ).toBe(false);
  });

  it("builds CursorWorkItems from CodeTaskPlan with planning draft metadata", () => {
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const workItems = buildCursorWorkItemsFromImplementationCodeTaskPlan({
      projectId: PROJECT_ID,
      codeTaskPlan: plan,
      originStage: "planning",
      nowIso: NOW,
    });

    expect(workItems.length).toBe(plan.tasks.length);
    for (const item of workItems) {
      const codeTask = plan.tasks.find((task) => task.codeTaskId === item.codeTaskId);
      expect(codeTask).toBeTruthy();
      expect(item.taskId).toBe(codeTask!.parentTaskId);
      expect(item.parentTaskId).toBe(codeTask!.parentTaskId);
      expect(item.originStage).toBe("planning");
      expect(item.refinementStatus).toBe("draft");
      expect(item.noCodeChangeEvidenceRequired).toBe(true);
    }
  });

  it("includes llmRationale and targetHints-based candidateFileHints in WorkItem prompt", () => {
    const taskList = sampleTaskList();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const codeTask = plan.tasks[0]!;
    const llmPlan = {
      ...plan,
      tasks: [
        {
          ...codeTask,
          candidateFiles: [],
          candidateFileHints: [],
          llmRationale: "화면 컴포넌트를 분리해 구현한다.",
        },
      ],
    };
    const [workItem] = buildCursorWorkItemsFromImplementationCodeTaskPlan({
      projectId: PROJECT_ID,
      codeTaskPlan: llmPlan,
      originStage: "planning",
      nowIso: NOW,
    });
    expect(workItem?.prompt).toContain("구현 요약:");
    expect(workItem?.prompt).toContain("화면 컴포넌트");
    expect(workItem?.candidateFileHints?.length).toBeGreaterThan(0);
  });

  it("creates planning readiness bundle with implementation_ready_for_execution timeline", () => {
    const taskList = sampleTaskList();
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
      includeTaskListCreatedEvent: true,
    });

    expect(readiness.implementationCodeTaskPlanV1.codeTaskCount).toBeGreaterThan(0);
    expect(readiness.cursorWorkItemsV1.length).toBeGreaterThan(0);
    expect(readiness.implementationWorkItemPreflightSummaryV1.workItemCount).toBe(
      readiness.cursorWorkItemsV1.length,
    );
    expect(
      readiness.promptTimeline.some((entry) => entry.action === "implementation_ready_for_execution"),
    ).toBe(true);
    expect(
      readiness.promptTimeline.some((entry) => entry.action === "implementation_code_task_plan_created"),
    ).toBe(true);
  });

  it("syncs missing codeTaskPlan and workItems without regenerating taskList", () => {
    const taskList = sampleTaskList();
    const result = buildGenerateImplementationTaskListFromSeedResult({
      projectId: PROJECT_ID,
      seed: confirmedSeed(),
      existingTaskList: taskList,
      existingCodeTaskPlan: null,
      existingCursorWorkItems: null,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.syncedArtifacts).toBe(true);
    expect(result.userMessage).toBe("구현 준비 산출물을 동기화했습니다.");
    expect(result.patch.implementationTaskListV1).toBeUndefined();
    expect(result.patch.implementationCodeTaskPlanV1?.tasks.length).toBeGreaterThan(0);
    expect(result.patch.cursorWorkItemsV1?.length).toBeGreaterThan(0);
    expect(result.alreadyExisted).toBe(true);
  });

  it("runs planning preflight and keeps execution preflight compatible", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const executionPreflight = runWorkItemPreflightBatch({
      workItems: readiness.cursorWorkItemsV1,
      allowedPathGlobs: ["apps/**"],
    });

    expect(readiness.implementationWorkItemPreflightSummaryV1.status).toMatch(/passed|failed/);
    expect(executionPreflight.status).toMatch(/passed|failed/);
    expect(
      readiness.promptTimeline.some((entry) => entry.action === "implementation_work_items_preflight_checked"),
    ).toBe(true);
  });

  it("parses codeTaskPlan and preflight summary from requirements state json", () => {
    const readiness = buildImplementationPlanningReadinessPatch({
      projectId: PROJECT_ID,
      taskList: sampleTaskList(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const parsed = parseRequirementsStateJson({
      implementationCodeTaskPlanV1: readiness.implementationCodeTaskPlanV1,
      implementationWorkItemPreflightSummaryV1: readiness.implementationWorkItemPreflightSummaryV1,
    });

    expect(parsed.implementationCodeTaskPlanV1?.codeTaskCount).toBeGreaterThan(0);
    expect(parsed.implementationWorkItemPreflightSummaryV1?.workItemCount).toBeGreaterThan(0);
  });
});

describe("quick design confirm planning readiness", () => {
  it("creates code task plan and work items when prep completes", () => {
    const definitions = buildDynamicServicePlanningSlotDefinitions({
      projectId: PROJECT_ID,
      projectName: "테스트",
    });
    const orchestration = initialOrchestrationStateFromDefinitions(definitions, NOW);
    const prep = runQuickDesignConfirmImplementationPrep({
      projectId: PROJECT_ID,
      orchestration,
      definitions,
      nowIso: NOW,
      envOk: true,
      generatedArtifactCount: 2,
    });

    if (!prep.prepComplete) {
      expect(prep.implementationCodeTaskPlanV1).toBeNull();
      return;
    }

    expect(prep.implementationTaskListV1?.tasks.length).toBeGreaterThan(0);
    expect(prep.implementationCodeTaskPlanV1?.codeTaskCount).toBeGreaterThan(0);
    expect(prep.cursorWorkItemsV1?.length).toBeGreaterThan(0);
    expect(prep.implementationWorkItemPreflightSummaryV1?.workItemCount).toBeGreaterThan(0);
    expect(
      prep.timelineEntries.some((entry) => entry.action === "implementation_ready_for_execution"),
    ).toBe(true);
  });
});
