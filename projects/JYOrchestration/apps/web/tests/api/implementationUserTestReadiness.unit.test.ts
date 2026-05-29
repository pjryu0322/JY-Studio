import { describe, expect, it } from "vitest";
import { buildImplementationExecutionBoard } from "@/lib/prototype/implementationExecutionBoard";
import {
  appendReworkRequest,
  buildInitialImplementationExecutionBoardState,
} from "@/lib/prototype/implementationExecutionBoardState";
import { deriveImplementationUserTestReadiness } from "@/lib/prototype/implementationUserTestReadiness";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksDoneForWip,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksDone,
} from "@/lib/prototype/implementationTaskExecutionState";
import {
  deriveIntegratedExecutionStateReadiness,
  markIntegratedStepDone,
  markIntegratedStepInProgress,
} from "@/lib/prototype/implementationIntegratedExecutionState";
import { buildImplementationExecutionBoardMessage } from "@/lib/prototype/implementationExecutionBoardMessage";
import { deriveImplementationStageNextActions } from "@/lib/prototype/implementationStageNextActions";
import { buildImplementationReviewStageReadyMarker } from "@/lib/prototype/implementationReviewStageReady";
import { mapImplementationChipToAction } from "@/lib/prototype/effectiveImplementationState";
import {
  IMPLEMENTATION_GENERATION_REQUEST_CHIP,
  REVIEW_STAGE_START_USER_TEST_CHIP,
} from "@/lib/requirements/implementationUxLabels";
import { parseRequirementsStateJson, mergeRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

const NOW = "2026-05-29T12:00:00.000Z";

function makeSeedForBoard(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
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

function fullyIntegratedCompleteBoard() {
  const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed: makeSeedForBoard() });
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
  executionState = markDeveloperTasksDoneForWip({
    state: executionState,
    cursorWorkItems: workItems,
    nowIso: NOW,
  });
  executionState = markPostDeveloperReviewTasksQueued({ state: executionState, nowIso: NOW });
  executionState = markRoleTasksDone({ state: executionState, ownerRole: "reviewer", nowIso: NOW });
  executionState = markRoleTasksDone({ state: executionState, ownerRole: "security", nowIso: NOW });
  executionState = markRoleTasksDone({ state: executionState, ownerRole: "scm", nowIso: NOW });
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
  const board = buildImplementationExecutionBoard({
    projectId: "p1",
    taskList,
    executionState,
    integratedExecutionState: integrated,
    nowIso: NOW,
  });
  return { taskList, executionState, integratedExecutionState: integrated, board };
}

describe("deriveImplementationUserTestReadiness", () => {
  it("missing task list returns missing_task_list", () => {
    const result = deriveImplementationUserTestReadiness({
      board: null,
      previewReady: true,
      hasTaskList: false,
      hasExecutionState: true,
    });
    expect(result.status).toBe("missing_task_list");
    expect(result.ready).toBe(false);
  });

  it("active rework returns blocked_by_rework", () => {
    const base = fullyIntegratedCompleteBoard();
    const boardState = appendReworkRequest({
      state: null,
      projectId: "p1",
      taskId: "dev-1",
      targetRole: "developer",
      reason: "수정",
      nowIso: NOW,
    });
    const board = buildImplementationExecutionBoard({
      projectId: "p1",
      taskList: base.taskList,
      executionState: base.executionState,
      integratedExecutionState: base.integratedExecutionState,
      boardState,
      nowIso: NOW,
    });
    const result = deriveImplementationUserTestReadiness({
      board,
      previewReady: true,
      hasTaskList: true,
      hasExecutionState: true,
      boardState,
    });
    expect(result.status).toBe("blocked_by_rework");
  });

  it("all complete + previewReady returns ready", () => {
    const base = fullyIntegratedCompleteBoard();
    const result = deriveImplementationUserTestReadiness({
      board: base.board,
      previewReady: true,
      hasTaskList: true,
      hasExecutionState: true,
    });
    expect(result.status).toBe("ready");
    expect(result.reviewStageMoveAllowed).toBe(true);
  });
});

describe("buildImplementationExecutionBoardMessage", () => {
  it("contains test summary with rework and review stage readiness", () => {
    const base = fullyIntegratedCompleteBoard();
    const message = buildImplementationExecutionBoardMessage({
      board: base.board,
      nowIso: NOW,
      previewReady: true,
      hasExecutionState: true,
    });
    expect(message.content).toContain("구현단계 테스트 요약");
    expect(message.content).toContain("재작업 요청:");
    expect(message.content).toContain("검토단계 이동 가능: 예");
  });
});

describe("implementation stage CTA regression", () => {
  it("taskList exists → no work plan draft primary", () => {
    const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed: makeSeedForBoard() });
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    const actions = deriveImplementationStageNextActions(
      "implementation_ready",
      executionState,
      null,
      { projectId: "p1", taskList, executionState, previewReady: false },
    );
    expect(actions[0]?.actionId).toBe("REQUEST_CODE_AGENT_WIP");
    expect(actions[0]?.label).toBe(IMPLEMENTATION_GENERATION_REQUEST_CHIP);
    expect(actions.some((a) => a.actionId === "GENERATE_IMPLEMENTATION_WORK_PLAN")).toBe(false);
  });

  it("incomplete board does not prioritize MOVE_TO_REVIEW_STAGE", () => {
    const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed: makeSeedForBoard() });
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    const actions = deriveImplementationStageNextActions(
      "task_list_ready",
      executionState,
      null,
      {
        projectId: "p1",
        taskList,
        executionState,
        previewReady: true,
        implementationReviewStageReadyV1: marker,
      },
    );
    expect(actions[0]?.actionId).not.toBe("MOVE_TO_REVIEW_STAGE");
    expect(actions.some((a) => a.actionId === "MOVE_TO_REVIEW_STAGE")).toBe(false);
  });

  it("review stage marker before board complete does not override generation request", () => {
    const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed: makeSeedForBoard() });
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    const marker = buildImplementationReviewStageReadyMarker({ previewReady: true, nowIso: NOW });
    const actions = deriveImplementationStageNextActions(
      "task_list_ready",
      executionState,
      null,
      {
        projectId: "p1",
        taskList,
        executionState,
        previewReady: true,
        implementationReviewStageReadyV1: marker,
      },
    );
    expect(actions.some((a) => a.actionId === "REVIEW_STAGE_START_USER_TEST")).toBe(false);
    expect(actions[0]?.actionId).toBe("REQUEST_CODE_AGENT_WIP");
  });
});

describe("review stage phase 2 conflict checks", () => {
  it("생성요청 maps to REQUEST_CODE_AGENT_WIP", () => {
    expect(mapImplementationChipToAction(IMPLEMENTATION_GENERATION_REQUEST_CHIP)).toBe(
      "REQUEST_CODE_AGENT_WIP",
    );
  });

  it("review stage chips map to REVIEW_STAGE_* without overriding 생성요청", () => {
    expect(mapImplementationChipToAction(REVIEW_STAGE_START_USER_TEST_CHIP)).toBe(
      "REVIEW_STAGE_START_USER_TEST",
    );
    expect(mapImplementationChipToAction(IMPLEMENTATION_GENERATION_REQUEST_CHIP)).toBe(
      "REQUEST_CODE_AGENT_WIP",
    );
  });

  it("requirementsStateJson parse preserves implementation and review stage fields", () => {
    const boardState = buildInitialImplementationExecutionBoardState({
      projectId: "p1",
      nowIso: NOW,
    });
    const merged = mergeRequirementsStateJson(parseRequirementsStateJson(null), {
      implementationExecutionBoardStateV1: boardState,
      reviewStageUserFeedbackListV1: {
        version: "review_stage_user_feedback_v1",
        projectId: "p1",
        createdAt: NOW,
        updatedAt: NOW,
        items: [],
      },
    });
    const parsed = parseRequirementsStateJson(merged);
    expect(parsed.implementationExecutionBoardStateV1?.projectId).toBe("p1");
    expect(parsed.reviewStageUserFeedbackListV1?.projectId).toBe("p1");
  });
});
