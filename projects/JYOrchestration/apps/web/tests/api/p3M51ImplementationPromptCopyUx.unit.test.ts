import { describe, expect, it } from "vitest";
import {
  buildStageTwoDeveloperPromptBundle,
  DEVELOPER_PROMPT_BUNDLE_NOT_FOR_CURSOR,
  formatDeveloperPromptBundleCopySuccessToast,
  orderCodeTaskIdsByBranchPlan,
  resolveDeveloperPromptCopyFromSelection,
} from "@/lib/prototype/codeTaskDeveloperPromptBundle";
import {
  assertStageTwoDeveloperPromptAllowed,
  isDeveloperPromptBundleContent,
} from "@/lib/prototype/codeTaskDeveloperPromptQualityGate";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import { prepareCodeTaskPlanForStageOnePrompt } from "@/lib/prototype/prepareCodeTaskPlanForStageOnePrompt";
import { resolveCodeTaskPromptDraftForCopyFromState } from "@/lib/prototype/resolveCodeTaskPromptDraftForCopy";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-06T12:00:00.000Z";
const PID = "p-m51";
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

function preparedPlan() {
  const list = meetingTaskList();
  return prepareCodeTaskPlanForStageOnePrompt({
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

describe("P3-M51 developer prompt bundle copy", () => {
  it("orders selected ids by branch plan execution order", () => {
    const { plan } = preparedPlan();
    const mock = plan.tasks.find((t) => t.parentTaskId === "DEV-MOCK-001")!.codeTaskId;
    const common = plan.tasks.find((t) => t.codeTaskId.includes("COMMON-001"))!.codeTaskId;
    const frame = plan.tasks.find((t) => t.branchPlan?.branchGroup === "foundation")!.codeTaskId;
    const ordered = orderCodeTaskIdsByBranchPlan({
      codeTaskPlan: plan,
      codeTaskIds: [common, mock, frame],
    });
    expect(ordered.indexOf(frame)).toBeLessThan(ordered.indexOf(mock));
    expect(ordered.indexOf(mock)).toBeLessThan(ordered.indexOf(common));
  });

  it("builds bundle with disclaimer for multiple tasks", () => {
    const { plan } = preparedPlan();
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: {},
    });
    const ids = plan.tasks
      .filter((t) => {
        const g = t.branchPlan?.branchGroup;
        return g === "foundation" || g === "data";
      })
      .map((t) => t.codeTaskId);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const result = buildStageTwoDeveloperPromptBundle({
      projectId: PID,
      codeTaskIds: ids,
      codeTaskPlan: plan,
      taskList: meetingTaskList(),
      cursorWorkItems: ids.map((id) => {
        const t = plan.tasks.find((x) => x.codeTaskId === id)!;
        return workItem(id, t.parentTaskId);
      }),
      runs: [],
      targetRepository: REPO,
      baseBranch: "main",
      codeTaskPromptContextMapV1: map,
    });
    expect(result.ok).toBe(true);
    expect(result.content).toContain("# CodeTask Developer Prompt Bundle");
    expect(result.content).toContain(DEVELOPER_PROMPT_BUNDLE_NOT_FOR_CURSOR);
    expect(result.content).not.toContain("# CodeTask 1단계 프롬프트 초안");
    expect(isDeveloperPromptBundleContent(result.content!)).toBe(true);
    expect(assertStageTwoDeveloperPromptAllowed({ prompt: result.content! }).ok).toBe(false);
  });

  it("copies single prompt without bundle wrapper when one id selected", () => {
    const { plan } = preparedPlan();
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: {},
    });
    const common = plan.tasks.find((t) => t.codeTaskId.includes("COMMON-001"))!;
    const result = resolveDeveloperPromptCopyFromSelection({
      projectId: PID,
      selectedCodeTaskIds: [common.codeTaskId],
      currentCodeTaskId: null,
      codeTaskPlan: plan,
      taskList: meetingTaskList(),
      cursorWorkItems: [workItem(common.codeTaskId, common.parentTaskId)],
      runs: [],
      targetRepository: REPO,
      baseBranch: "main",
      codeTaskPromptContextMapV1: map,
    });
    expect(result.ok).toBe(true);
    expect(result.prompt).toMatch(/^# CodeTask 개발 요청/);
    expect(result.content).toMatch(/^# CodeTask 개발 요청/);
    expect(result.content).not.toContain("Developer Prompt Bundle");
    expect(result.content).toContain("wip/data/sample-data");
  });

  it("uses current code task when nothing selected", () => {
    const { plan } = preparedPlan();
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: {},
    });
    const frame = plan.tasks.find((t) => t.branchPlan?.branchGroup === "foundation")!;
    const result = resolveDeveloperPromptCopyFromSelection({
      projectId: PID,
      selectedCodeTaskIds: [],
      currentCodeTaskId: frame.codeTaskId,
      codeTaskPlan: plan,
      taskList: meetingTaskList(),
      cursorWorkItems: [workItem(frame.codeTaskId, frame.parentTaskId)],
      runs: [],
      targetRepository: REPO,
      baseBranch: "main",
      codeTaskPromptContextMapV1: map,
    });
    expect(result.ok).toBe(true);
    expect(result.content).toContain("wip/foundation/app-shell");
  });

  it("stage one planning draft is distinct from developer prompt", () => {
    const { plan } = preparedPlan();
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: {},
    });
    const stageOne = resolveCodeTaskPromptDraftForCopyFromState({
      requirementsStateJson: {
        projectId: PID,
        implementationCodeTaskPlanV1: plan,
        implementationTaskListV1: meetingTaskList(),
        codeTaskPromptContextMapV1: map,
      },
      mode: "all",
    });
    expect(stageOne.prompt).toContain("# CodeTask 1단계 프롬프트 초안");
    expect(formatDeveloperPromptBundleCopySuccessToast(3)).toContain("3개");
  });
});
