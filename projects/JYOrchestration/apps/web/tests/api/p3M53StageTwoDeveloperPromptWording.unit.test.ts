import { describe, expect, it } from "vitest";
import { buildStageTwoCodeTaskDeveloperPrompt } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import { prepareCodeTaskPlanForStageOnePrompt } from "@/lib/prototype/prepareCodeTaskPlanForStageOnePrompt";
import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-07T12:00:00.000Z";
const PID = "p-m53";
const REPO = {
  owner: "o",
  repo: "r",
  defaultBranch: "main",
  repoFullName: "o/r",
  provider: "github" as const,
  gitRepoUrl: "https://github.com/o/r",
};

function meetingTaskList(): ImplementationTaskListV1 {
  const tasks = [
    { taskId: "DEV-FRAME-001", title: "화면 프레임/앱 Shell 구성", taskType: "feature" as const },
    { taskId: "DEV-MOCK-001", title: "샘플 데이터 생성", taskType: "feature" as const },
    { taskId: "DEV-COMMON-001", title: "로딩 상태 공통 기능 구현", taskType: "feature" as const },
    { taskId: "DEV-FEATURE-001", title: "시작 기능 구현", taskType: "feature" as const },
    { taskId: "DEV-SCREEN-001", title: "입력 화면 화면 구현", taskType: "screen" as const },
  ].map((t) => ({
    ...t,
    description: t.title,
    ownerRole: "developer" as const,
    priority: "high" as const,
    status: "ready" as const,
    dependencies: [],
    acceptanceCriteria: ["a", "b", "c"],
    sourceRefs: [],
  }));
  return {
    version: 1,
    projectId: PID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "implementation_seed_v1",
    tasks,
    roleSummary: { developer: tasks.length, designer: 0, reviewer: 0, security: 0, scm: 0 },
  };
}

function prepared() {
  const list = meetingTaskList();
  const plan = prepareCodeTaskPlanForStageOnePrompt({
    projectId: PID,
    baseBranch: "main",
    plan: buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    }),
    taskList: list,
    nowIso: NOW,
  });
  const map = buildCodeTaskPromptContextMap({
    projectId: PID,
    codeTaskPlan: plan.plan,
    requirementsStateJson: {},
  });
  return { list, plan: plan.plan, map };
}

function workItem(codeTaskId: string, parentTaskId: string) {
  return {
    id: `wi-${codeTaskId}`,
    taskId: parentTaskId,
    codeTaskId,
    title: "wi",
    prompt: "",
    requiredFilesHint: [],
    expectedOutput: [],
    testCommands: [],
    forbiddenPaths: [],
    blocked: false,
    blockers: [],
    qualityGate: { promptReady: true, missing: [], score: 100 },
  };
}

describe("P3-M53 stage two developer prompt wording", () => {
  it("foundation branch principles avoid main regression wording", () => {
    const { plan, map } = prepared();
    const frame = plan.tasks.find((t) => t.branchPlan?.branchGroup === "foundation")!;
    const gen = buildStageTwoCodeTaskDeveloperPrompt({
      projectId: PID,
      targetRepository: REPO,
      codeTask: frame,
      promptContext: map.contexts[frame.codeTaskId]!,
      branchPlan: frame.branchPlan!,
      fileBoundary: frame.fileBoundary!,
      nowIso: NOW,
    });
    expect(gen.quality.ready).toBe(true);
    expect(gen.content).not.toContain("main 기준이 아니라");
    expect(gen.content).toContain("foundation group은 첫 구현 단위");
    expect(gen.content).toContain("필요한 범위만 보완");
    expect(gen.content).toContain("app/page.*");
    expect(gen.content).toContain("src/App.*");
    expect(gen.content).toContain("실제 저장소에 존재하는 파일을 우선 사용");
    expect(gen.content).toContain("동일 목적의 route/app entry");
    expect(gen.content).toContain("routeEntryDecision:");
  });

  it("common group uses predecessor base branch and shell preservation", () => {
    const { list, plan, map } = prepared();
    const common = plan.tasks.find((t) => t.branchPlan?.branchGroup === "common")!;
    expect(common.branchPlan?.baseBranch).toBe("wip/data/sample-data");
    const copy = resolveCodeTaskDeveloperPromptForCopy({
      projectId: PID,
      codeTaskId: common.codeTaskId,
      codeTaskPlan: plan,
      taskList: list,
      cursorWorkItems: [workItem(common.codeTaskId, common.parentTaskId)],
      runs: [],
      targetRepository: REPO,
      baseBranch: "main",
      codeTaskPromptContextMapV1: map,
    });
    expect(copy.ok).toBe(true);
    expect(copy.prompt).toContain("선행 group work branch");
    expect(copy.prompt).toContain("기존 App Shell 구조를 재작성하지 않는다");
  });

  it("search scope and work result report sections are explicit", () => {
    const { plan, map } = prepared();
    const feature = plan.tasks.find((t) => t.branchPlan?.branchGroup === "feature")!;
    const gen = buildStageTwoCodeTaskDeveloperPrompt({
      projectId: PID,
      targetRepository: REPO,
      codeTask: feature,
      promptContext: map.contexts[feature.codeTaskId]!,
      branchPlan: feature.branchPlan!,
      fileBoundary: feature.fileBoundary!,
      nowIso: NOW,
    });
    expect(gen.content).toContain("탐색만 허용");
    expect(gen.content).toContain("실제 코드 변경은 반드시 `수정 허용 파일`");
    expect(gen.content).toContain("## 작업 결과 보고 형식");
    expect(gen.content).toContain("requiresIntegrationChange:");
    expect(gen.content).toContain("noCodeChange:");
    expect(gen.content).toMatch(/^# CodeTask 개발 요청/);
    expect(gen.content).not.toContain("# CodeTask 1단계 프롬프트 초안");
  });
});
