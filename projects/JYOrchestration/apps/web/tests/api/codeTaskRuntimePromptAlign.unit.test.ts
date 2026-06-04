import { describe, expect, it } from "vitest";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import {
  refineProblemToSolveForRuntime,
  refineTargetUsersForRuntime,
} from "@/lib/prototype/codeTaskRuntimePromptContextView";
import { GENERATED_PROJECT_PROBE_PATHS } from "@/lib/prototype/codeTaskPromptPathPolicy";
import {
  buildImplementationCodeTaskPlanFromTaskList,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { attachTemplateContextToSeed, resolveSelectedPrototypeTemplateForPlanning } from "@/lib/requirements/implementationPrototypeTemplateContext";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
import { DEV_FRAME_TASK_ID } from "@/lib/requirements/implementationPrototypeTemplateContext";

const NOW = "2026-06-04T00:00:00.000Z";
const REPO = {
  owner: "o",
  repo: "r",
  defaultBranch: "main",
  repoFullName: "o/r",
  gitRepoUrl: "https://github.com/o/r.git",
  gitRepoProvider: "github",
} as const;

function meetingSeed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_slots_and_artifacts",
    lifecycleStatus: "confirmed",
    readiness: { ready: true, score: 1, missing: [], warnings: [] },
    processImplementationItems: [],
    screenImplementationItems: [
      {
        id: "s-in",
        screenName: "입력 화면",
        accessibleActors: ["user"],
        actions: [],
        visibleData: [],
        editableData: [],
        states: [],
      },
      {
        id: "s-out",
        screenName: "결과 화면",
        accessibleActors: ["user"],
        actions: [],
        visibleData: [],
        editableData: [],
        states: [],
      },
    ],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [
      { name: "로딩 상태", appliesTo: ["전체"], description: "", required: true },
      { name: "재시도", appliesTo: ["전체"], description: "", required: true },
    ],
    dataModelSeed: { entities: [], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
    assumptions: [],
    gaps: [],
  };
}

function buildPlanAndMap() {
  const seed = attachTemplateContextToSeed({
    seed: meetingSeed(),
    templateContext: resolveSelectedPrototypeTemplateForPlanning({ seed: meetingSeed() }),
  });
  const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed, nowIso: NOW });
  const plan = buildImplementationCodeTaskPlanFromTaskList({
    projectId: "p1",
    taskList,
    envOk: true,
    designOk: true,
    nowIso: NOW,
  });
  const map = buildCodeTaskPromptContextMap({
    projectId: "p1",
    codeTaskPlan: plan,
    requirementsStateJson: { implementationSeedV1: seed, implementationTaskListV1: taskList },
    nowIso: NOW,
  });
  return { plan, map, templateId: seed.templateContext?.templateId };
}

function promptFor(
  plan: ReturnType<typeof buildImplementationCodeTaskPlanFromTaskList>,
  map: ReturnType<typeof buildCodeTaskPromptContextMap>,
  match: (t: ImplementationCodeTaskV1) => boolean,
  templateId?: string,
) {
  const codeTask = plan.tasks.find(match)!;
  const ctx = map.contexts[codeTask.codeTaskId]!;
  const built = buildCodeTaskDeveloperPromptDetailed({
    codeTask,
    promptContext: ctx,
    targetRepository: REPO,
    baseBranch: "main",
    targetRepoKind: "generated_project",
    templateId,
  });
  return built.prompt;
}

describe("P3-M23 runtime prompt alignment", () => {
  it("refines screen names out of target users", () => {
    const users = refineTargetUsersForRuntime({
      targetUsers: ["워크스페이스", "회의 목록"],
      relatedScreens: [],
    });
    expect(users[0]).toMatch(/회의 녹취/);
    expect(users.join(" ")).not.toContain("워크스페이스");
  });

  it("refines duplicate service goal and problem", () => {
    const problem = refineProblemToSolveForRuntime({
      serviceGoal: "녹취 업로드·변환·화자 분리·회의록 초안/요약·스크립트 확인을 한 화면에서 처리",
      problemToSolve: "녹취 업로드·변환·화자 분리·회의록 초안/요약·스크립트 확인을 한 화면에서 처리",
    });
    expect(problem).toMatch(/STT 변환/);
    expect(problem).not.toBe("녹취 업로드·변환·화자 분리·회의록 초안/요약·스크립트 확인을 한 화면에서 처리");
  });

  it("app shell prompt excludes loading template and includes layout", () => {
    const { plan, map, templateId } = buildPlanAndMap();
    const frameTask = plan.tasks.find((t) => t.parentTaskId === DEV_FRAME_TASK_ID)!;
    const prompt = promptFor(plan, map, (t) => t.codeTaskId === frameTask.codeTaskId, templateId);
    expect(prompt).toMatch(/3열|회의 파일|작업 공간|결과 패널/i);
    expect(prompt).not.toMatch(/LoadingState|Spinner|Skeleton|loading flag/i);
    expect(prompt).not.toContain("기획 산출물 기준으로 공통 동작");
  });

  it("input screen prompt has upload requirements not mock helper", () => {
    const { plan, map, templateId } = buildPlanAndMap();
    const prompt = promptFor(plan, map, (t) => /입력\s*화면/i.test(t.title), templateId);
    expect(prompt).toContain("회의 파일 업로드/선택 진입점");
    expect(prompt).not.toContain("mock data 또는 fixture helper");
  });

  it("loading common task includes LoadingState requirements", () => {
    const { plan, map, templateId } = buildPlanAndMap();
    const prompt = promptFor(plan, map, (t) => /로딩\s*상태/i.test(t.title), templateId);
    expect(prompt).toMatch(/LoadingState|Spinner|Skeleton/i);
  });

  it("retry task includes RetryButton and onRetry", () => {
    const { plan, map, templateId } = buildPlanAndMap();
    const prompt = promptFor(plan, map, (t) => /재시도/i.test(t.title), templateId);
    expect(prompt).toMatch(/RetryButton|onRetry|중복 클릭/i);
  });

  it("probe paths include expanded globs when no safe candidates", () => {
    expect(GENERATED_PROJECT_PROBE_PATHS).toEqual(
      expect.arrayContaining(["src/**", "app/**", "public/**", "__tests__/**"]),
    );
    const built = buildCodeTaskDeveloperPromptDetailed({
      codeTask: {
        codeTaskId: "CT-PROBE",
        parentTaskId: "DEV-1",
        title: "재시도",
        description: "",
        changeType: "component",
        acceptanceCriteria: [],
        verificationHints: [],
        forbiddenPaths: [],
        candidateFiles: [],
        candidateFileHints: [],
      },
      targetRepository: REPO,
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    expect(built.prompt).toContain("src/**");
    expect(built.prompt).not.toMatch(/package\.json scripts를 확인/);
  });
});
