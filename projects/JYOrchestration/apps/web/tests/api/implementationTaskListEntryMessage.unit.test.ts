import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import {
  markDeveloperTasksInProgressForWip,
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markPostDeveloperReviewTasksQueued,
  markRoleTasksInProgress,
  summarizeImplementationTaskExecutionItems,
} from "@/lib/prototype/implementationTaskExecutionState";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";
import {
  deriveImplementationPrototypeRunSyncSnapshot,
  syncImplementationTaskExecutionFromPrototypeRun,
} from "@/lib/prototype/implementationPrototypeRunSync";
import { executeImplementationQualityGateCheck } from "@/lib/prototype/implementationQualityGate";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  buildDeveloperImplementationRequestPrepMessage,
  buildImplementationTaskListEntryMessage,
  buildImplementationTaskListMissingEntryMessage,
  buildImplementationTaskListViewMessage,
  buildImplementationPrototypeCompleteMessage,
  buildReviewerCheckTaskMessage,
  hasValidImplementationTaskListBootstrap,
  IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
  buildSecurityCheckTaskMessage,
  implementationTaskListEntryChips,
  tryHandleImplementationTaskListChip,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/prototype/implementationTaskListEntryMessage";
import { IMPLEMENTATION_EXECUTION_BOARD_CHIP, IMPLEMENTATION_GENERATION_REQUEST_CHIP } from "@/lib/requirements/implementationUxLabels";
import { buildImplementationBootstrapBundle } from "@/lib/prototype/implementationOrchestrationSummary";
import {
  hasAnyValidImplementationBootstrap,
  hasImplementationOrchestrationBootstrap,
  sanitizeImplementationConversationMessages,
} from "@/lib/prototype/implementationOrchestrationSummary";
import {
  implementationEntryChipsForState,
  WORK_PLAN_DRAFT_GENERATE_CHIP,
} from "@/lib/prototype/implementationWorkPlanDraft";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import type { ProjectArtifact } from "@/lib/requirements/projectArtifactTypes";

const NOW = "2026-05-28T00:00:00.000Z";

const planningArtifacts: readonly ProjectArtifact[] = [
  {
    id: "a1",
    type: "fast_prototype_plan",
    title: "프로토타입 기획안",
    content: "# plan",
    createdAt: NOW,
    createdBy: "ai",
    sourceStage: "IDEATION",
  },
];

function makeSeed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_slots_and_artifacts",
    lifecycleStatus: "confirmed",
    readiness: { ready: true, score: 1, missing: [], warnings: [] },
    processImplementationItems: [
      {
        id: "proc-1",
        processName: "회원가입",
        actors: ["user"],
        screens: ["회원가입"],
        actions: ["submit"],
        dataTouched: ["user"],
        exceptions: [],
      },
    ],
    screenImplementationItems: [
      {
        id: "screen-1",
        screenName: "회의록 업로드",
        accessibleActors: ["user"],
        actions: ["upload"],
        visibleData: ["title"],
        editableData: ["file"],
        states: ["idle"],
      },
    ],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [{ name: "검색", appliesTo: ["list"], description: "검색", required: true }],
    dataModelSeed: {
      entities: ["MeetingNote"],
      fieldsByEntity: { MeetingNote: ["id"] },
      relationships: [],
      mockDataNotes: [],
    },
  };
}

describe("implementationTaskListEntryMessage", () => {
  const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed: makeSeed(), nowIso: NOW });

  it("builds task list ready entry message with role summary", () => {
    const message = buildImplementationTaskListEntryMessage({
      taskList,
      envOk: true,
      nowIso: NOW,
    });
    expect(message.content).toContain("구현 작업목록이 준비되었습니다");
    expect(message.content).toContain("AI 개발자:");
    expect(message.meta?.interviewSuggestions).toContain(AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP);
    expect(message.meta?.interviewSuggestions).toContain("작업목록 보기");
    expect(message.meta?.interviewSuggestions).not.toContain(WORK_PLAN_DRAFT_GENERATE_CHIP);
    expect(message.content).not.toContain("구현 작업안 초안");
  });

  it("prioritizes env settings when envOk=false", () => {
    const chips = implementationTaskListEntryChips({ envOk: false });
    expect(chips[0]).toBe("환경설정 열기");
    expect(chips).not.toContain(AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP);
  });

  it("builds task list ready entry message with envOk=false chips and warning", () => {
    const message = buildImplementationTaskListEntryMessage({
      taskList,
      envOk: false,
      nowIso: NOW,
    });
    expect(message.content).toContain("실행 환경 설정이 필요합니다");
    expect(message.meta?.interviewSuggestions?.[0]).toBe("환경설정 열기");
    expect(message.meta?.interviewSuggestions).toContain("작업목록 보기");
    expect(message.meta?.interviewSuggestions).not.toContain(AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP);
    expect(message.meta?.interviewSuggestions).not.toContain(WORK_PLAN_DRAFT_GENERATE_CHIP);
  });

  it("builds task list missing entry message with planning-first chips when seed absent", () => {
    const message = buildImplementationTaskListMissingEntryMessage({ nowIso: NOW });
    expect(message.content).toContain("구현 작업목록이 아직 없습니다");
    expect(message.content).toContain("Quick Design");
    expect(message.meta?.interviewSuggestions?.[0]).toBe("기획단계로 이동");
    expect(message.meta?.interviewSuggestions).not.toContain("구현 작업목록 생성");
  });

  it("treats task list missing bootstrap as a valid implementation bootstrap", () => {
    const message = buildImplementationTaskListMissingEntryMessage({ nowIso: NOW });
    expect(hasValidImplementationTaskListBootstrap([message])).toBe(true);
    expect(hasAnyValidImplementationBootstrap([message])).toBe(true);
    expect(hasImplementationOrchestrationBootstrap([message])).toBe(true);
  });

  it("keeps task list missing bootstrap after sanitizeImplementationConversationMessages()", () => {
    const message = buildImplementationTaskListMissingEntryMessage({ nowIso: NOW });
    const sanitized = sanitizeImplementationConversationMessages([message]);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]?.meta?.implementationBootstrapKind).toBe("task_list_missing");
    expect(sanitized[0]?.content).toContain("구현 작업목록이 아직 없습니다");
  });

  it("confirmed seed missing message does not ask Quick Design again", () => {
    const seed = {
      version: "implementation_seed_v1" as const,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      lifecycleStatus: "confirmed" as const,
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
    const message = buildImplementationTaskListMissingEntryMessage({
      nowIso: NOW,
      implementationSeedV1: seed,
      implementationTaskListV1: null,
    });
    expect(message.content).not.toContain("Quick Design을 다시 확정");
    expect(message.content).toContain("Implementation Seed");
    expect(message.meta?.interviewSuggestions?.[0]).toBe("구현 작업목록 생성");
  });

  it("shows developer request prep without work plan draft requirement", () => {
    const prep = buildDeveloperImplementationRequestPrepMessage({
      taskList,
      envOk: true,
      nowIso: NOW,
    });
    expect(prep.content).not.toContain("구현 작업안 초안 생성");
    expect(prep.meta?.interviewSuggestions).toContain("코드 에이전트 WIP 작업 요청");
  });

  it("shows env-first chips for developer request prep when envOk=false", () => {
    const prep = buildDeveloperImplementationRequestPrepMessage({
      taskList,
      envOk: false,
      nowIso: NOW,
    });
    expect(prep.meta?.interviewSuggestions?.[0]).toBe("환경설정 열기");
    expect(prep.meta?.interviewSuggestions).not.toContain("코드 에이전트 WIP 작업 요청");
  });

  it("routes AI developer request chip: envOk=true appends message", () => {
    const appendAiMessage = vi.fn();
    const openEnvSettings = vi.fn();
    const handled = tryHandleImplementationTaskListChip({
      label: "AI 개발자에게 구현 요청",
      taskList,
      envOk: true,
      nowIso: NOW,
      appendAiMessage,
      openEnvSettings,
      returnToPlanningStage: vi.fn(),
      showToast: vi.fn(),
    });
    expect(handled).toBe(true);
    expect(appendAiMessage).toHaveBeenCalledTimes(1);
    expect(openEnvSettings).toHaveBeenCalledTimes(0);
  });

  it("routes AI developer request chip: envOk=false opens env settings", () => {
    const appendAiMessage = vi.fn();
    const openEnvSettings = vi.fn();
    const handled = tryHandleImplementationTaskListChip({
      label: "AI 개발자에게 구현 요청",
      taskList,
      envOk: false,
      nowIso: NOW,
      appendAiMessage,
      openEnvSettings,
      returnToPlanningStage: vi.fn(),
      showToast: vi.fn(),
    });
    expect(handled).toBe(true);
    expect(appendAiMessage).toHaveBeenCalledTimes(0);
    expect(openEnvSettings).toHaveBeenCalledTimes(1);
  });

  it("delegates generation request chip to action pipeline", () => {
    const appendAiMessage = vi.fn();
    const handled = tryHandleImplementationTaskListChip({
      label: IMPLEMENTATION_GENERATION_REQUEST_CHIP,
      taskList,
      envOk: true,
      nowIso: NOW,
      appendAiMessage,
      openEnvSettings: vi.fn(),
      returnToPlanningStage: vi.fn(),
      showToast: vi.fn(),
    });
    expect(handled).toBe(false);
    expect(appendAiMessage).toHaveBeenCalledTimes(0);
  });

  it("shows execution board on 구현 작업 보드 chip", () => {
    const appendAiMessage = vi.fn();
    const handled = tryHandleImplementationTaskListChip({
      label: IMPLEMENTATION_EXECUTION_BOARD_CHIP,
      projectId: "p1",
      taskList,
      envOk: true,
      nowIso: NOW,
      appendAiMessage,
      openEnvSettings: vi.fn(),
      returnToPlanningStage: vi.fn(),
      showToast: vi.fn(),
    });
    expect(handled).toBe(true);
    expect(appendAiMessage).toHaveBeenCalledTimes(1);
    expect(appendAiMessage.mock.calls[0]?.[0]?.content).toContain("구현 작업 보드입니다");
  });

  it("lists tasks on 작업목록 보기", () => {
    const view = buildImplementationTaskListViewMessage({ taskList, nowIso: NOW });
    expect(view.content).toContain("보드 요약:");
    expect(view.content).toContain("TASK ID");
    expect(view.content).toContain(taskList.tasks[0]?.taskId ?? "");
    expect(view.meta?.interviewSuggestions).not.toContain(TASK_LIST_VIEW_CHIP);
    expect(view.meta?.interviewSuggestions).toContain("구현 작업 보드");
  });

  it("buildImplementationTaskListViewMessage with executionState shows execution summary", () => {
    const devTask = taskList.tasks.find((t) => t.ownerRole === "developer");
    const workItems: readonly CursorWorkItem[] = devTask
      ? [
          {
            id: "wi-dev",
            taskId: devTask.taskId,
            title: devTask.title,
            prompt: "p",
            requiredFilesHint: [],
            expectedOutput: [],
            testCommands: [],
            forbiddenPaths: [],
            blocked: false,
            blockers: [],
            qualityGate: { score: 1, promptReady: true, missing: [] },
          },
        ]
      : [];
    const executionState = markDeveloperTasksInProgressForWip({
      state: buildInitialImplementationTaskExecutionStateFromTaskList({
        projectId: "p1",
        taskList,
        nowIso: NOW,
      }),
      taskList,
      cursorWorkItems: workItems,
      projectId: "p1",
      nowIso: NOW,
    });
    const view = buildImplementationTaskListViewMessage({
      taskList,
      executionState,
      nowIso: NOW,
    });
    expect(view.content).toContain("작업 실행 상태");
    expect(view.content).toContain("진행 중");
    expect(devTask).toBeDefined();
    expect(view.content).toContain(`${devTask!.taskId} |`);
    expect(view.content).toMatch(new RegExp(`${devTask!.taskId} \\| [^|]+ \\| [^|]+ \\| [^|]+ \\| in_progress`));
  });

  it("shows security role queue on 보안 점검", () => {
    const security = buildSecurityCheckTaskMessage({ taskList, nowIso: NOW });
    expect(security.content).toContain("보안");
    const securityTask = taskList.tasks.find((t) => t.ownerRole === "security");
    if (securityTask) {
      expect(security.content).toContain(securityTask.taskId);
    }
  });

  it("uses unified task list bootstrap when task list execution ready", () => {
    const bundle = buildImplementationBootstrapBundle({
      projectId: "p1",
      env: { git: "ok", github: "ok", cursor: "ok", connectionTest: "ok" },
      envOk: true,
      envSettingsHref: "/settings",
      featureDraftTitles: [],
      projectArtifacts: planningArtifacts,
      artifactOrchestrationV1: null,
      designOk: true,
      implementationSeedV1: makeSeed(),
      implementationTaskListV1: taskList,
      nowIso: NOW,
    });
    expect(bundle.messages).toHaveLength(1);
    expect(bundle.messages[0]?.content).toContain("구현 작업목록이 준비되었습니다");
    expect(bundle.messages[0]?.content).toContain("작업 요약:");
    expect(bundle.messages[0]?.content).toContain("다음 실행 대상:");
    expect(hasValidImplementationTaskListBootstrap(bundle.messages)).toBe(true);
  });

  it("treats task list bootstrap as a valid implementation bootstrap", () => {
    const message = buildImplementationTaskListEntryMessage({ taskList, envOk: true, nowIso: NOW });
    expect(hasValidImplementationTaskListBootstrap([message])).toBe(true);
    expect(hasAnyValidImplementationBootstrap([message])).toBe(true);
    expect(hasImplementationOrchestrationBootstrap([message])).toBe(true);
  });

  it("keeps task list bootstrap after sanitizeImplementationConversationMessages()", () => {
    const message = buildImplementationTaskListEntryMessage({ taskList, envOk: true, nowIso: NOW });
    const sanitized = sanitizeImplementationConversationMessages([message]);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0]?.meta?.implementationBootstrapKind).toBe("task_list_ready");
    expect(sanitized[0]?.content).toContain("구현 작업목록이 준비되었습니다");
  });

  it("hides work plan draft chip on implementation entry when task list ready", () => {
    const chips = implementationEntryChipsForState({
      seedReady: true,
      envOk: true,
      designOk: true,
      hasReferenceArtifacts: true,
      taskListReady: true,
    });
    expect(chips).toContain(AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP);
    expect(chips).toContain(IMPLEMENTATION_GENERATION_REQUEST_CHIP);
    expect(chips).toContain(TASK_LIST_VIEW_CHIP);
    expect(chips).not.toContain(WORK_PLAN_DRAFT_GENERATE_CHIP);
  });

  it("uses env-first chips on implementation entry when task list ready but envOk=false", () => {
    const chips = implementationEntryChipsForState({
      seedReady: true,
      envOk: false,
      designOk: true,
      hasReferenceArtifacts: true,
      taskListReady: true,
    });
    expect(chips[0]).toBe("환경설정 열기");
    expect(chips).toContain("작업목록 보기");
    expect(chips).not.toContain(AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP);
    expect(chips).not.toContain(WORK_PLAN_DRAFT_GENERATE_CHIP);
  });

  it("buildImplementationPrototypeCompleteMessage includes preview URL and chip", () => {
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
    const prototypeSnapshot = deriveImplementationPrototypeRunSyncSnapshot({
      latestRun: {
        id: "run-1",
        status: "PREVIEW_READY",
        previewUrl: "https://preview.example/app",
      },
    });
    executionState = syncImplementationTaskExecutionFromPrototypeRun({
      state: executionState,
      snapshot: prototypeSnapshot,
      nowIso: NOW,
    })!;
    const message = buildImplementationPrototypeCompleteMessage({
      prototypeSnapshot,
      executionState,
      nowIso: NOW,
    });
    expect(message?.content).toContain("내부 검수와 보안 점검 기준을 통과");
    expect(message?.content).toContain("https://preview.example/app");
    expect(message?.meta?.interviewSuggestions).toContain(IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP);
  });

  it("buildReviewerCheckTaskMessage includes latest quality gate result", () => {
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
    const gate = executeImplementationQualityGateCheck({
      role: "reviewer",
      taskList,
      executionState,
      projectId: "p1",
      nowIso: NOW,
    });
    if ("blocked" in gate) throw new Error("expected gate");
    const message = buildReviewerCheckTaskMessage({
      taskList,
      executionState: gate.executionState,
      qualityGateResults: gate.qualityGateResults,
      nowIso: NOW,
    });
    expect(message.content).toContain("점검 결과:");
    expect(message.content).toContain("통과");
  });

  it("tryHandleImplementationTaskListChip opens prototype preview chip", () => {
    const openPrototypePreview = vi.fn();
    const handled = tryHandleImplementationTaskListChip({
      label: IMPLEMENTATION_PROTOTYPE_PREVIEW_CHIP,
      taskList,
      prototypeSnapshot: deriveImplementationPrototypeRunSyncSnapshot({
        latestRun: { id: "run-1", status: "PREVIEW_READY", previewUrl: "https://preview.example/app" },
      }),
      openPrototypePreview,
      appendAiMessage: vi.fn(),
      showToast: vi.fn(),
    });
    expect(handled).toBe(true);
    expect(openPrototypePreview).toHaveBeenCalledOnce();
  });
});
