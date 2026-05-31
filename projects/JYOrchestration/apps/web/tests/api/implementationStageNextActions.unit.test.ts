import { describe, expect, it } from "vitest";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksDoneForWip,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksDone,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  deriveImplementationStageNextActions,
  deriveReviewStageNextActions,
  prioritizeImplementationChipsByNextActions,
  prioritizeImplementationChipsForState,
} from "@/lib/prototype/implementationStageNextActions";
import { buildImplementationReviewStageReadyMarker } from "@/lib/prototype/implementationReviewStageReady";
import { appendReviewStageUserFeedback } from "@/lib/prototype/reviewStageUserFeedback";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  AI_DEVELOPER_REMEDIATION_REQUEST_CHIP,
  IMPLEMENTATION_ENV_SETTINGS_LABEL,
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
  TASK_LIST_VIEW_CHIP,
  MOVE_TO_REVIEW_STAGE_CHIP,
  REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP,
  REVIEW_STAGE_START_USER_TEST_CHIP,
  REVIEWER_CHECK_CHIP,
  REVIEWER_CHECK_RUN_CHIP,
  RUN_FINAL_SCM_CHIP,
  RUN_INTEGRATED_REVIEW_CHIP,
  RUN_INTEGRATED_SECURITY_CHIP,
  RUN_REFACTOR_COMMON_CHIP,
  SCM_CRITERIA_CHIP,
  SECURITY_CHECK_CHIP,
  REQUEST_TASK_REWORK_CHIP,
  SECURITY_CHECK_RUN_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import {
  deriveIntegratedExecutionStateReadiness,
  markIntegratedStepDone,
  markIntegratedStepInProgress,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import {
  appendReworkRequest,
  parseImplementationExecutionBoardStateV1,
} from "@/lib/prototype/implementationExecutionBoardState";
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
import {
  buildInitialCodeAgentWipExecution,
  CODE_AGENT_WIP_DRAFT_APPROVE_CHIP,
  REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP,
} from "@/lib/prototype/codeAgentWipExecution";
import { AI_DEVELOPER_EXECUTION_REQUEST_CHIP, buildInitialTaskCursorExecution } from "@/lib/prototype/taskCursorExecution";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";

describe("deriveImplementationStageNextActions", () => {
  it("not_ready -> SHOW_ENV_CHECK primary", () => {
    const actions = deriveImplementationStageNextActions("not_ready");
    expect(actions[0]?.actionId).toBe("SHOW_ENV_CHECK");
    expect(actions[0]?.priority).toBe("primary");
  });

  it("task_list_ready -> 생성요청 primary and env settings secondary", () => {
    const actions = deriveImplementationStageNextActions("task_list_ready");
    expect(actions[0]?.label).toBe(IMPLEMENTATION_GENERATION_REQUEST_CHIP);
    expect(actions[0]?.priority).toBe("primary");
    expect(actions[1]?.label).toBe(IMPLEMENTATION_ENV_SETTINGS_LABEL);
    expect(actions.map((a) => a.label)).not.toContain(TASK_LIST_VIEW_CHIP);
  });

  it("draft_created wip -> Cursor 실행 요청 and WIP 초안 승인 next actions", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: [],
      featureDraftTitles: ["upload"],
      envOk: true,
      designOk: true,
    });
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      executionMode: "stub",
      bridgeExecutionStatus: "draft_created",
      selectedTaskId: plan.items[0]?.id,
    });
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      projectId: "p1",
      taskList: buildImplementationTaskListFromSeed({
        projectId: "p1",
        seed: {
          version: "implementation_seed_v1",
          projectId: "p1",
          createdAt: "2026-05-29T12:00:00.000Z",
          updatedAt: "2026-05-29T12:00:00.000Z",
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
        },
      }),
      codeAgentWipExecutionV1: wip,
    });
    expect(actions[0]?.actionId).toBe("REQUEST_CURSOR_BRIDGE_EXECUTION");
    expect(actions[0]?.label).toBe(REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP);
    expect(actions.some((a) => a.label === CODE_AGENT_WIP_DRAFT_APPROVE_CHIP)).toBe(true);
  });

  it("draft_approved wip -> primary action REQUEST_CURSOR_BRIDGE_EXECUTION", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: [],
      featureDraftTitles: ["upload"],
      envOk: true,
      designOk: true,
    });
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      executionMode: "stub",
      bridgeExecutionStatus: "draft_approved",
      selectedTaskId: plan.items[0]?.id,
    });
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      projectId: "p1",
      codeAgentWipExecutionV1: wip,
    });
    expect(actions[0]?.actionId).toBe("REQUEST_CURSOR_BRIDGE_EXECUTION");
    expect(actions[0]?.label).toBe(REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP);
  });

  it("failed wip -> primary action REQUEST_CURSOR_BRIDGE_EXECUTION", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: [],
      featureDraftTitles: ["upload"],
      envOk: true,
      designOk: true,
    });
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const wip = buildInitialCodeAgentWipExecution({
      projectId: "p1",
      plan,
      workItems,
      executionMode: "cursor_api",
      bridgeExecutionStatus: "failed",
      selectedTaskId: plan.items[0]?.id,
    });
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      projectId: "p1",
      codeAgentWipExecutionV1: wip,
    });
    expect(actions[0]?.actionId).toBe("REQUEST_CURSOR_BRIDGE_EXECUTION");
    expect(actions[0]?.label).toBe(REQUEST_CURSOR_BRIDGE_EXECUTION_CHIP);
  });

  it("task cursor pending -> AI 개발자 실행 요청 primary without WIP draft", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: {
        version: "implementation_seed_v1",
        projectId: "p1",
        createdAt: "2026-05-29T12:00:00.000Z",
        updatedAt: "2026-05-29T12:00:00.000Z",
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
      },
    });
    const execution = buildInitialTaskCursorExecution({
      projectId: "p1",
      taskId: "DEV-MOCK-001",
      workItemIds: ["wi-1"],
      targetRepository: "owner/repo",
      baseBranch: "main",
    });
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      projectId: "p1",
      taskList,
      taskCursorExecutionV1: execution,
    });
    expect(actions[0]?.actionId).toBe("REQUEST_TASK_CURSOR_EXECUTION");
    expect(actions[0]?.label).toBe(AI_DEVELOPER_EXECUTION_REQUEST_CHIP);
  });

  it("task cursor failed -> endpoint unsupported retry CTA", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: {
        version: "implementation_seed_v1",
        projectId: "p1",
        createdAt: "2026-05-29T12:00:00.000Z",
        updatedAt: "2026-05-29T12:00:00.000Z",
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
      },
    });
    const execution = {
      ...buildInitialTaskCursorExecution({
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        workItemIds: ["wi-1"],
        targetRepository: "owner/repo",
        baseBranch: "main",
      }),
      status: "cursor_failed" as const,
      failureReason: "cursor_endpoint_unsupported" as const,
      errorMessage: "endpoint unsupported",
    };
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      projectId: "p1",
      taskList,
      taskCursorExecutionV1: execution,
    });
    expect(actions[0]?.actionId).toBe("REQUEST_TASK_REWORK");
    expect(actions[0]?.reason).toContain("endpoint");
  });

  it("task cursor github verified -> no manual reviewer/security primary CTAs", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: {
        version: "implementation_seed_v1",
        projectId: "p1",
        createdAt: "2026-05-29T12:00:00.000Z",
        updatedAt: "2026-05-29T12:00:00.000Z",
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
      },
    });
    const execution = {
      ...buildInitialTaskCursorExecution({
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        workItemIds: ["wi-1"],
        targetRepository: "owner/repo",
        baseBranch: "main",
      }),
      status: "review_pending" as const,
      commitSha: "eb3db901234567890abcdef1234567890abcdef",
    };
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      projectId: "p1",
      taskList,
      taskCursorExecutionV1: execution,
    });
    expect(actions.some((action) => action.actionId === "RUN_REVIEWER_CHECK" && action.priority === "primary")).toBe(
      false,
    );
    expect(actions.some((action) => action.actionId === "RUN_SECURITY_CHECK" && action.priority === "primary")).toBe(
      false,
    );
  });

  it("auto gate failed -> rework primary CTA", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: {
        version: "implementation_seed_v1",
        projectId: "p1",
        createdAt: "2026-05-29T12:00:00.000Z",
        updatedAt: "2026-05-29T12:00:00.000Z",
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
      },
    });
    const execution = {
      ...buildInitialTaskCursorExecution({
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        workItemIds: ["wi-1"],
        targetRepository: "owner/repo",
        baseBranch: "main",
      }),
      status: "review_pending" as const,
      commitSha: "eb3db901234567890abcdef1234567890abcdef",
    };
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      projectId: "p1",
      taskList,
      taskCursorExecutionV1: execution,
      implementationAutoQualityGateV1: {
        version: "implementation_auto_quality_gate_v1",
        projectId: "p1",
        taskId: "DEV-MOCK-001",
        sourceCommitSha: "eb3db901234567890abcdef1234567890abcdef",
        changedFiles: ["src/a.ts"],
        status: "failed",
        failureReason: "review failed",
        startedAt: "2026-05-30T12:00:00.000Z",
        updatedAt: "2026-05-30T12:00:00.000Z",
      },
    });
    expect(actions[0]?.actionId).toBe("REQUEST_TASK_REWORK");
    expect(actions[0]?.label).toBe(REQUEST_TASK_REWORK_CHIP);
  });

  it("cursor_api completed WIP -> 구현 결과 승인", () => {
    const wip = {
      ...buildInitialCodeAgentWipExecution({
        projectId: "p1",
        plan: buildImplementationTaskPlan({
          projectId: "p1",
          projectArtifacts: [],
          featureDraftTitles: ["upload"],
          envOk: true,
          designOk: true,
        }),
        workItems: [],
        executionMode: "cursor_api",
        bridgeExecutionStatus: "bridge_completed",
      }),
      commits: [
        {
          provider: "cursor" as const,
          sha: "abc123def4567890",
          branchName: "wip/cursor/dev-1",
          commitMessage: "wip",
          taskId: "dev-1",
          workItemId: "wi-1",
          changedFiles: ["src/App.tsx"],
          diffSummary: [],
          testResults: [],
          unresolvedIssues: [],
          createdAt: "2026-05-29T12:00:00.000Z",
        },
      ],
      bridgeAdapter: "cursor_api" as const,
      executionStatus: "bridge_completed" as const,
    };
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      codeAgentWipExecutionV1: wip,
    });
    expect(actions?.[0]?.label).toBe("구현 결과 승인");
    expect(actions?.some((a) => a.label === "SCM 반영 요청")).toBe(false);
  });

  it("developer_approved cursor WIP -> SCM 반영 요청", () => {
    const wip = {
      ...buildInitialCodeAgentWipExecution({
        projectId: "p1",
        plan: buildImplementationTaskPlan({
          projectId: "p1",
          projectArtifacts: [],
          featureDraftTitles: ["upload"],
          envOk: true,
          designOk: true,
        }),
        workItems: [],
        executionMode: "cursor_api",
        bridgeExecutionStatus: "bridge_completed",
      }),
      status: "developer_approved" as const,
      commits: [
        {
          provider: "cursor" as const,
          sha: "abc123def4567890",
          branchName: "wip/cursor/dev-1",
          commitMessage: "wip",
          taskId: "dev-1",
          workItemId: "wi-1",
          changedFiles: ["src/App.tsx"],
          diffSummary: [],
          testResults: [],
          unresolvedIssues: [],
          createdAt: "2026-05-29T12:00:00.000Z",
        },
      ],
      bridgeAdapter: "cursor_api" as const,
      executionStatus: "bridge_completed" as const,
      platformScmExecutionV1: {
        version: "platform_scm_execution_v1" as const,
        projectId: "p1",
        selectedTaskId: "dev-1",
        sourceCommitSha: "abc123def4567890",
        sourceBranchName: "wip/cursor/dev-1",
        targetRepository: "owner/repo",
        pushStatus: "pending" as const,
        createdAt: "2026-05-29T12:00:00.000Z",
        updatedAt: "2026-05-29T12:00:00.000Z",
      },
    };
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      codeAgentWipExecutionV1: wip,
    });
    expect(actions?.[0]?.label).toBe("SCM 반영 요청");
    expect(actions?.some((a) => a.label === "구현 결과 승인")).toBe(false);
  });

  it("developer_approved cursor WIP hides SCM 반영 요청 when canApplyGit is false", () => {
    const wip = {
      ...buildInitialCodeAgentWipExecution({
        projectId: "p1",
        plan: buildImplementationTaskPlan({
          projectId: "p1",
          projectArtifacts: [],
          featureDraftTitles: ["upload"],
          envOk: true,
          designOk: true,
        }),
        workItems: [],
        executionMode: "cursor_api",
        bridgeExecutionStatus: "bridge_completed",
      }),
      status: "developer_approved" as const,
      commits: [
        {
          provider: "cursor" as const,
          sha: "abc123def4567890",
          branchName: "wip/cursor/dev-1",
          commitMessage: "wip",
          taskId: "dev-1",
          workItemId: "wi-1",
          changedFiles: ["src/App.tsx"],
          diffSummary: [],
          testResults: [],
          unresolvedIssues: [],
          createdAt: "2026-05-29T12:00:00.000Z",
        },
      ],
      platformScmExecutionV1: {
        version: "platform_scm_execution_v1" as const,
        projectId: "p1",
        selectedTaskId: "dev-1",
        sourceCommitSha: "abc123def4567890",
        sourceBranchName: "wip/cursor/dev-1",
        targetRepository: "owner/repo",
        pushStatus: "pending" as const,
        createdAt: "2026-05-29T12:00:00.000Z",
        updatedAt: "2026-05-29T12:00:00.000Z",
      },
    };
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      codeAgentWipExecutionV1: wip,
      canApplyGit: false,
    });
    expect(actions?.some((a) => a.label === "SCM 반영 요청")).toBe(false);
    expect(actions?.some((a) => a.label === "변경사항 보기")).toBe(true);
  });

  it("push_failed WIP -> SCM 재시도", () => {
    const wip = {
      ...buildInitialCodeAgentWipExecution({
        projectId: "p1",
        plan: buildImplementationTaskPlan({
          projectId: "p1",
          projectArtifacts: [],
          featureDraftTitles: ["upload"],
          envOk: true,
          designOk: true,
        }),
        workItems: [],
        executionMode: "cursor_api",
        bridgeExecutionStatus: "bridge_completed",
        status: "scm_commit_pending",
      }),
      commits: [
        {
          provider: "cursor" as const,
          sha: "abc123def4567890",
          branchName: "wip/cursor/dev-1",
          commitMessage: "wip",
          taskId: "dev-1",
          workItemId: "wi-1",
          changedFiles: ["src/App.tsx"],
          diffSummary: [],
          testResults: [],
          unresolvedIssues: [],
          createdAt: "2026-05-29T12:00:00.000Z",
        },
      ],
      platformScmExecutionV1: {
        version: "platform_scm_execution_v1" as const,
        projectId: "p1",
        selectedTaskId: "dev-1",
        sourceCommitSha: "abc123def4567890",
        sourceBranchName: "wip/cursor/dev-1",
        targetRepository: "owner/repo",
        pushStatus: "push_failed" as const,
        createdAt: "2026-05-29T12:00:00.000Z",
        updatedAt: "2026-05-29T12:00:00.000Z",
      },
    };
    const actions = deriveImplementationStageNextActions("task_list_ready", null, null, {
      codeAgentWipExecutionV1: wip,
    });
    expect(actions?.[0]?.label).toBe("SCM 재시도");
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

  it("previewReady true + board incomplete does not return prototype preview primary", () => {
    const input = completedBoardInput();
    const prototypeSnapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: {
        id: "run-1",
        status: "PREVIEW_READY",
        previewUrl: "https://preview.example/app",
        workUnits: [],
      },
    });
    const actions = deriveImplementationStageNextActions(
      "prototype_ready",
      input.executionState,
      prototypeSnapshot,
      input,
    );
    expect(actions[0]?.label).toBe(RUN_REFACTOR_COMMON_CHIP);
    expect(actions.some((a) => a.label === IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP)).toBe(false);
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

  function fullyIntegratedCompleteInput() {
    const input = completedBoardInput();
    let integrated = deriveIntegratedExecutionStateReadiness({
      projectId: "p1",
      state: null,
      taskRowsCompleted: true,
      nowIso: NOW,
    });
    for (const step of [
      "refactor_common",
      "integrated_review",
      "integrated_security",
      "final_scm",
    ] as const) {
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
    return { ...input, previewReady: true, integratedExecutionState: integrated };
  }

  it("active rework + previewReady true prioritizes remediation over review stage", () => {
    const input = fullyIntegratedCompleteInput();
    const devTaskId =
      input.taskList.tasks.find((t) => t.ownerRole === "developer")?.taskId ?? "dev-1";
    let boardState = parseImplementationExecutionBoardStateV1({
      version: "implementation_execution_board_state_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      userConfirmations: [],
      reworkRequests: [],
    });
    boardState = appendReworkRequest({
      state: boardState,
      projectId: "p1",
      taskId: devTaskId,
      targetRole: "developer",
      reason: "active",
      nowIso: NOW,
    });
    const actions = deriveImplementationStageNextActions("task_list_ready", input.executionState, null, {
      ...input,
      boardState,
    });
    expect(actions[0]?.label).toBe(AI_DEVELOPER_REMEDIATION_REQUEST_CHIP);
    expect(actions[0]?.label).not.toBe(MOVE_TO_REVIEW_STAGE_CHIP);
  });

  it("board complete + previewReady returns MOVE_TO_REVIEW_STAGE before review-stage chips", () => {
    const input = fullyIntegratedCompleteInput();
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    const actions = deriveImplementationStageNextActions("task_list_ready", input.executionState, null, {
      ...input,
      previewReady: true,
      implementationReviewStageReadyV1: marker,
    });
    expect(actions[0]?.actionId).toBe("MOVE_TO_REVIEW_STAGE");
    expect(actions.some((a) => a.actionId === "REVIEW_STAGE_START_USER_TEST")).toBe(false);
  });

  it("active feedback + previewReady true prioritizes 구현단계 보완 요청", () => {
    const input = fullyIntegratedCompleteInput();
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    const feedbackList = appendReviewStageUserFeedback({
      list: null,
      projectId: "p1",
      title: "피드백",
      detail: "수정",
      nowIso: NOW,
    });
    const actions = deriveReviewStageNextActions({
      feedbackList,
    });
    expect(actions[0]?.label).toBe(REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION_CHIP);
    expect(actions[0]?.label).not.toBe(MOVE_TO_REVIEW_STAGE_CHIP);
  });

  it("blocking feedback prevents 검토 완료 primary in deriveReviewStageNextActions", () => {
    const feedbackList = appendReviewStageUserFeedback({
      list: null,
      projectId: "p1",
      title: "blocking",
      detail: "d",
      severity: "blocking",
      nowIso: NOW,
    });
    const actions = deriveReviewStageNextActions({ feedbackList });
    expect(actions[0]?.actionId).toBe("REVIEW_STAGE_SEND_FEEDBACK_TO_IMPLEMENTATION");
    expect(actions.some((a) => a.actionId === "REVIEW_STAGE_COMPLETE_TEST")).toBe(false);
  });

  it("board complete + previewReady true prioritizes MOVE_TO_REVIEW_STAGE over implementation generation", () => {
    const input = fullyIntegratedCompleteInput();
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    const actions = deriveImplementationStageNextActions("task_list_ready", input.executionState, null, {
      ...input,
      previewReady: true,
      implementationReviewStageReadyV1: marker,
    });
    expect(actions[0]?.actionId).toBe("MOVE_TO_REVIEW_STAGE");
    expect(actions.some((a) => a.actionId === "GENERATE_IMPLEMENTATION_WORK_PLAN")).toBe(false);
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

