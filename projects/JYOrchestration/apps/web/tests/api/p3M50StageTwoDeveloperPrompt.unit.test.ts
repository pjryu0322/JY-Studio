import { describe, expect, it } from "vitest";
import { buildStageOneCodeTaskPlanningSummaryPrompt } from "@/lib/prototype/buildCodeTaskStageOnePrompt";
import { buildStageTwoCodeTaskDeveloperPrompt } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import {
  assertStageTwoDeveloperPromptAllowed,
  isStageOnePlanningSummaryPromptContent,
} from "@/lib/prototype/codeTaskDeveloperPromptQualityGate";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import { prepareCodeTaskPlanForStageOnePrompt } from "@/lib/prototype/prepareCodeTaskPlanForStageOnePrompt";
import { resolveCodeTaskDeveloperPromptForCopy } from "@/lib/prototype/resolveCodeTaskDeveloperPromptForCopy";
import { resolveExecutionTargetCodeTaskId } from "@/lib/prototype/resolveExecutionTargetCodeTaskId";
import { resolveStageTwoDeveloperPromptPreview } from "@/lib/prototype/resolveStageTwoDeveloperPromptPreview";
import { formatCodeTaskPromptDraftBundle } from "@/lib/prototype/formatCodeTaskPromptDraft";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-05T12:00:00.000Z";
const PID = "p-m50";
const REPO = {
  owner: "pjryu0322",
  repo: "aiprogect",
  defaultBranch: "main",
  repoFullName: "pjryu0322/aiprogect",
  provider: "github" as const,
  gitRepoUrl: "https://github.com/pjryu0322/aiprogect",
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

describe("P3-M50 stage one vs stage two prompts", () => {
  it("tags stage one planning bundle separately from stage two", () => {
    const list = meetingTaskList();
    const prepared = prepareCodeTaskPlanForStageOnePrompt({
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
      codeTaskPlan: prepared.plan,
      requirementsStateJson: {},
    });
    const stageOne = buildStageOneCodeTaskPlanningSummaryPrompt({
      projectId: PID,
      codeTaskPlan: prepared.plan,
      taskList: list,
      codeTaskPromptContextMapV1: map,
    });
    expect(stageOne.stage).toBe("stage_one_planning_summary");
    expect(stageOne.content).toContain("# CodeTask 1단계 프롬프트 초안");
    expect(assertStageTwoDeveloperPromptAllowed({ prompt: stageOne.content }).ok).toBe(false);

    const commonId = "CODE-DEV-COMMON-001-001";
    const common = prepared.plan.tasks.find((t) => t.codeTaskId === commonId)!;
    const ctx = map.contexts[commonId]!;
    const stageTwo = buildStageTwoCodeTaskDeveloperPrompt({
      projectId: PID,
      targetRepository: REPO,
      codeTask: common,
      promptContext: ctx,
      branchPlan: common.branchPlan!,
      fileBoundary: common.fileBoundary!,
      nowIso: NOW,
    });
    expect(stageTwo.stage).toBe("stage_two_developer_execution");
    expect(stageTwo.quality.ready).toBe(true);
    expect(stageTwo.content).toContain("# CodeTask 개발 요청");
    expect(stageTwo.content).not.toContain("## 프로젝트 구현 준비 요약");
    expect(isStageOnePlanningSummaryPromptContent(stageTwo.content)).toBe(false);
  });

  it("blocks stage one content in cursor stage-two gate", () => {
    const bundle = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: buildImplementationCodeTaskPlanFromTaskList({
        projectId: PID,
        taskList: meetingTaskList(),
        envOk: true,
        designOk: true,
        nowIso: NOW,
      }),
      taskList: meetingTaskList(),
      promptContextMap: null,
    });
    expect(isStageOnePlanningSummaryPromptContent(bundle)).toBe(true);
    expect(assertStageTwoDeveloperPromptAllowed({ prompt: bundle }).ok).toBe(false);
  });
});

describe("P3-M50 branch inheritance in developer prompt", () => {
  it("inherits branchPlan base/work branches per group", () => {
    const list = meetingTaskList();
    const prepared = prepareCodeTaskPlanForStageOnePrompt({
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
      codeTaskPlan: prepared.plan,
      requirementsStateJson: {},
    });
    const common = prepared.plan.tasks.find((t) => t.branchPlan?.branchGroup === "common")!;
    const feature = prepared.plan.tasks.find((t) => t.branchPlan?.branchGroup === "feature")!;
    const screen = prepared.plan.tasks.find((t) => t.branchPlan?.branchGroup === "screen")!;
    expect(common.branchPlan?.baseBranch).toBe("wip/data/sample-data");
    expect(common.branchPlan?.workBranch).toBe("wip/common/components");
    expect(feature.branchPlan?.baseBranch).toBe("wip/common/components");
    expect(screen.branchPlan?.baseBranch).toBe("wip/feature/core-flow");

    const copy = resolveCodeTaskDeveloperPromptForCopy({
      projectId: PID,
      codeTaskId: common.codeTaskId,
      codeTaskPlan: prepared.plan,
      taskList: list,
      cursorWorkItems: [
        {
          id: "wi-common",
          taskId: common.parentTaskId,
          codeTaskId: common.codeTaskId,
          title: "wi",
          prompt: "",
          requiredFilesHint: [],
          expectedOutput: [],
          testCommands: [],
          forbiddenPaths: [],
          blocked: false,
          blockers: [],
          qualityGate: { promptReady: true, missing: [], score: 100 },
        },
      ],
      runs: [],
      targetRepository: REPO,
      baseBranch: "main",
      codeTaskPromptContextMapV1: map,
    });
    expect(copy.ok).toBe(true);
    expect(copy.prompt).toContain("wip/data/sample-data");
    expect(copy.prompt).toContain("wip/common/components");
    expect(copy.prompt).not.toContain("wip/cursor/code-dev");
  });
});

describe("P3-M50 resolve execution target CodeTask", () => {
  it("prefers explicit selection over runtime current", () => {
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
    }).plan;
    expect(
      resolveExecutionTargetCodeTaskId({
        selectedCodeTaskId: "CODE-DEV-MOCK-001-001",
        runtimeCurrentCodeTaskId: "CODE-DEV-FRAME-001-001",
        codeTaskPlan: plan,
      }),
    ).toBe("CODE-DEV-MOCK-001-001");
  });

  it("builds single-task preview without full plan bundle", () => {
    const list = meetingTaskList();
    const prepared = prepareCodeTaskPlanForStageOnePrompt({
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
      codeTaskPlan: prepared.plan,
      requirementsStateJson: {},
    });
    const preview = resolveStageTwoDeveloperPromptPreview({
      projectId: PID,
      codeTaskPlan: prepared.plan,
      taskList: list,
      codeTaskPromptContextMapV1: map,
      targetRepository: REPO,
      selectedCodeTaskId: "CODE-DEV-COMMON-001-001",
    });
    expect(preview.ready).toBe(true);
    expect(preview.preview).toContain("# CodeTask 개발 요청");
    expect(preview.preview).not.toContain("## CodeTask 목록");
    expect(preview.preview).toMatch(/LoadingState|Skeleton/);
  });
});
