import { describe, expect, it, vi } from "vitest";
import { buildWipChipHandlerSlice } from "@/lib/prototype/prototypeExecutionWipChipHandlers";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksInProgressForWip,
} from "@/lib/prototype/implementationTaskExecutionState";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import type { CodeAgentWipExecutionV1 } from "@/lib/prototype/codeAgentWipExecution";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const nowIso = "2026-05-28T12:00:00.000Z";

function sampleTaskList(): ImplementationTaskListV1 {
  return {
    version: "implementation_task_list_v1",
    projectId: "p-wip",
    createdAt: nowIso,
    updatedAt: nowIso,
    source: "implementation_seed",
    tasks: [
      {
        taskId: "dev-1",
        title: "화면 A",
        description: "d",
        taskType: "screen",
        ownerRole: "developer",
        priority: "high",
        dependencies: [],
        acceptanceCriteria: [],
        status: "ready",
      },
    ],
    roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

const workItems: readonly CursorWorkItem[] = [
  {
    id: "wi-1",
    taskId: "dev-1",
    title: "화면 A",
    prompt: "p",
    requiredFilesHint: [],
    expectedOutput: [],
    testCommands: ["npm test"],
    forbiddenPaths: ["/node_modules"],
    blocked: false,
    blockers: [],
    qualityGate: { score: 0.9, promptReady: true, missing: [] },
  },
];

function wipForReview(): CodeAgentWipExecutionV1 {
  return {
    version: "code_agent_wip_execution_v1",
    projectId: "p-wip",
    provider: "cursor",
    status: "developer_reviewing",
    branchName: "wip/p-wip",
    requestedAt: nowIso,
    requestedBy: "ai_developer",
    workItems: ["wi-1"],
    refactorRequests: [],
    commits: [
      {
        provider: "cursor",
        branchName: "wip/p-wip",
        commitMessage: "wip",
        taskId: "dev-1",
        workItemId: "wi-1",
        changedFiles: ["src/a.ts"],
        diffSummary: [],
        testResults: ["ok"],
        unresolvedIssues: [],
        createdAt: nowIso,
      },
    ],
  };
}

function makeDeps(overrides?: Partial<Parameters<typeof buildWipChipHandlerSlice>[0]>) {
  const showToast = vi.fn();
  const persistOrchestration = vi.fn();
  const taskList = sampleTaskList();
  const executionState = markDeveloperTasksInProgressForWip({
    state: buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p-wip",
      taskList,
      nowIso,
    }),
    taskList,
    cursorWorkItems: workItems,
    projectId: "p-wip",
    nowIso,
  });

  const base = {
    projectId: "p-wip",
    requirementsStateJson: {},
    parsedState: {
      implementationTaskPlanV1: undefined,
      implementationTaskListV1: taskList,
      cursorWorkItemsV1: undefined,
      codeAgentWipExecutionV1: undefined,
      implementationTaskExecutionStateV1: executionState,
      promptTimeline: [],
    },
    applyMessages: vi.fn(),
    appendNotice: vi.fn(),
    persistOrchestration,
    focusComposer: vi.fn(),
    showToast,
  };

  return {
    ...buildWipChipHandlerSlice({ ...base, ...overrides }),
    showToast,
    persistOrchestration,
    taskList,
    executionState,
  };
}

describe("prototypeExecutionWipChipHandlers", () => {
  it("requestCodeAgentWipWork without plan/workItems does not show 구현 작업안 확정", () => {
    const { showToast, requestCodeAgentWipWork } = makeDeps();
    requestCodeAgentWipWork();
    expect(showToast).toHaveBeenCalled();
    const message = String(showToast.mock.calls[0]?.[0] ?? "");
    expect(message).not.toContain("구현 작업안 확정");
    expect(message).not.toContain("구현 작업안 초안");
  });

  it("requestCodeAgentWipWork without plan/workItems shows TaskList-aware fallback message", () => {
    const { showToast, requestCodeAgentWipWork } = makeDeps();
    requestCodeAgentWipWork();
    expect(showToast).toHaveBeenCalledWith(
      "구현 작업목록 기준 Code Agent WIP 후보를 먼저 준비해 주세요.",
    );
  });

  it("requestCodeAgentWipWork without task list shows generic fallback message", () => {
    const showToast = vi.fn();
    const { requestCodeAgentWipWork } = buildWipChipHandlerSlice({
      projectId: "p-wip",
      requirementsStateJson: {},
      parsedState: {
        implementationTaskPlanV1: undefined,
        implementationTaskListV1: null,
        cursorWorkItemsV1: undefined,
        codeAgentWipExecutionV1: undefined,
        implementationTaskExecutionStateV1: null,
        promptTimeline: [],
      },
      applyMessages: vi.fn(),
      appendNotice: vi.fn(),
      persistOrchestration: vi.fn(),
      focusComposer: vi.fn(),
      showToast,
    });
    requestCodeAgentWipWork();
    expect(showToast).toHaveBeenCalledWith("구현 작업목록 또는 작업 계획을 먼저 준비해 주세요.");
  });

  it("discardWipWork persists failed WIP and developer task failed execution state", () => {
    const showToast = vi.fn();
    const persistOrchestration = vi.fn();
    const taskList = sampleTaskList();
    const wip = wipForReview();
    const executionState = markDeveloperTasksInProgressForWip({
      state: buildInitialImplementationTaskExecutionStateFromTaskList({
        projectId: "p-wip",
        taskList,
        nowIso,
      }),
      taskList,
      cursorWorkItems: workItems,
      projectId: "p-wip",
      nowIso,
    });
    const { discardWipWork } = buildWipChipHandlerSlice({
      projectId: "p-wip",
      requirementsStateJson: {},
      parsedState: {
        implementationTaskPlanV1: undefined,
        implementationTaskListV1: taskList,
        cursorWorkItemsV1: workItems,
        codeAgentWipExecutionV1: wip,
        implementationTaskExecutionStateV1: executionState,
        promptTimeline: [],
      },
      applyMessages: vi.fn(),
      appendNotice: vi.fn(),
      persistOrchestration,
      focusComposer: vi.fn(),
      showToast,
    });
    discardWipWork();
    expect(persistOrchestration).toHaveBeenCalled();
    const orch = persistOrchestration.mock.calls[0]?.[1];
    expect(orch?.codeAgentWipExecutionV1?.status).toBe("failed");
    const dev = orch?.implementationTaskExecutionStateV1?.items.find((i) => i.taskId === "dev-1");
    expect(dev?.status).toBe("failed");
    expect(showToast).toHaveBeenCalledWith("WIP 작업을 폐기했습니다.");
  });

  it("approveDeveloperResult persists developer_approved WIP and done execution state", () => {
    const showToast = vi.fn();
    const persistOrchestration = vi.fn();
    const taskList = sampleTaskList();
    const wip = wipForReview();
    const executionState = markDeveloperTasksInProgressForWip({
      state: buildInitialImplementationTaskExecutionStateFromTaskList({
        projectId: "p-wip",
        taskList,
        nowIso,
      }),
      taskList,
      cursorWorkItems: workItems,
      projectId: "p-wip",
      nowIso,
    });
    const { approveDeveloperResult } = buildWipChipHandlerSlice({
      projectId: "p-wip",
      requirementsStateJson: {},
      parsedState: {
        implementationTaskPlanV1: undefined,
        implementationTaskListV1: taskList,
        cursorWorkItemsV1: workItems,
        codeAgentWipExecutionV1: wip,
        implementationTaskExecutionStateV1: executionState,
        promptTimeline: [],
      },
      applyMessages: vi.fn(),
      appendNotice: vi.fn(),
      persistOrchestration,
      focusComposer: vi.fn(),
      showToast,
    });
    approveDeveloperResult();
    expect(persistOrchestration).toHaveBeenCalled();
    const orch = persistOrchestration.mock.calls[0]?.[1];
    expect(orch?.codeAgentWipExecutionV1?.status).toBe("developer_approved");
    const dev = orch?.implementationTaskExecutionStateV1?.items.find((i) => i.taskId === "dev-1");
    expect(dev?.status).toBe("done");
  });
});
