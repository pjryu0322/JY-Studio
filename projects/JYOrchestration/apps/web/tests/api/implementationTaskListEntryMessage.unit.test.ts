import { describe, expect, it } from "vitest";
import {
  AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP,
  buildDeveloperImplementationRequestPrepMessage,
  buildImplementationTaskListEntryMessage,
  buildImplementationTaskListViewMessage,
  buildSecurityCheckTaskMessage,
  implementationTaskListEntryChips,
  TASK_LIST_VIEW_CHIP,
} from "@/lib/prototype/implementationTaskListEntryMessage";
import { buildImplementationBootstrapBundle } from "@/lib/prototype/implementationOrchestrationSummary";
import { hasAnyValidImplementationBootstrap } from "@/lib/prototype/implementationOrchestrationSummary";
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
    expect(message.meta?.interviewSuggestions).not.toContain(WORK_PLAN_DRAFT_GENERATE_CHIP);
  });

  it("prioritizes env settings when envOk=false", () => {
    const chips = implementationTaskListEntryChips({ envOk: false });
    expect(chips[0]).toBe("환경설정 열기");
    expect(chips).not.toContain(AI_DEVELOPER_IMPLEMENTATION_REQUEST_CHIP);
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

  it("lists tasks on 작업목록 보기", () => {
    const view = buildImplementationTaskListViewMessage({ taskList, nowIso: NOW });
    expect(view.content).toContain("TASK ID");
    expect(view.content).toContain(taskList.tasks[0]?.taskId ?? "");
  });

  it("shows security role queue on 보안 점검", () => {
    const security = buildSecurityCheckTaskMessage({ taskList, nowIso: NOW });
    expect(security.content).toContain("보안");
    const securityTask = taskList.tasks.find((t) => t.ownerRole === "security");
    if (securityTask) {
      expect(security.content).toContain(securityTask.taskId);
    }
  });

  it("uses task list bootstrap when task list execution ready", () => {
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
    expect(bundle.messages[0]?.content).toContain("구현 작업목록이 준비되었습니다");
    expect(bundle.messages[0]?.meta?.implementationBootstrapKind).toBe("task_list_ready");
  });

  it("treats task list bootstrap as a valid implementation bootstrap", () => {
    const message = buildImplementationTaskListEntryMessage({ taskList, envOk: true, nowIso: NOW });
    expect(hasAnyValidImplementationBootstrap([message])).toBe(true);
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
    expect(chips).toContain(TASK_LIST_VIEW_CHIP);
    expect(chips).not.toContain(WORK_PLAN_DRAFT_GENERATE_CHIP);
  });
});
