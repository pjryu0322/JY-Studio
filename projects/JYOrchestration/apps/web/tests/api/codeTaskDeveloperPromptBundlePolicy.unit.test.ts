import { describe, expect, it } from "vitest";
import { buildStageTwoDeveloperPromptBundle } from "@/lib/prototype/codeTaskDeveloperPromptBundle";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import { buildImplementationCodeTaskPlanFromTaskList } from "@/lib/prototype/implementationCodeTaskPlan";
import { buildWorkResultReportFormatSections } from "@/lib/prototype/codeTaskDeveloperPromptTemplate";
import { buildCodeTaskBranchPlanPromptSections } from "@/lib/prototype/implementationBranchPlan";
import { prepareCodeTaskPlanForStageOnePrompt } from "@/lib/prototype/prepareCodeTaskPlanForStageOnePrompt";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";
import type { CodeTaskBranchPlanV1 } from "@/lib/prototype/implementationBranchPlan";

const NOW = "2026-06-06T12:00:00.000Z";
const PID = "p-bundle-policy";
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

describe("codeTaskDeveloperPromptBundlePolicy", () => {
  it("includes execution and branch group policies in multi-task bundle", () => {
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
    const bundle = result.content ?? "";
    expect(bundle).toContain("Integration은 사용자가 플랫폼에서 **통합 버튼**을 선택했을 때");
    expect(bundle).toContain("동일 branch group에 속한 여러 CodeTask는 같은 work branch에 순차 누적된다");
    expect(bundle).toContain("work branch가 이미 origin에 존재하면 base branch에서 새로 만들지 않는다");
    expect(bundle).toContain(
      "동일 work branch 공유는 Integration 단계에서 branch group 단위 검증을 하기 위한 의도된 구조다",
    );
    expect(bundle).toContain("## Branch Group Intent");
    expect(bundle).not.toContain("이 Bundle 실행 후 자동 통합한다");
    expect(bundle).not.toContain("CodeTask 단계에서 PR/merge/Preview 연결을 수행한다");
  });

  it("includes work branch reuse section in branch plan prompt sections", () => {
    const branchPlan: CodeTaskBranchPlanV1 = {
      branchGroup: "common",
      workBranch: "wip/common/components",
      baseBranch: "wip/data/sample",
      executionMode: "sequential",
    };
    const sections = buildCodeTaskBranchPlanPromptSections(branchPlan).join("\n");
    expect(sections).toContain("## work branch 재사용 원칙");
    expect(sections).toContain(
      "동일 work branch 공유는 Integration 단계에서 branch group 단위 검증을 하기 위한 의도된 구조다",
    );
  });

  it("includes workBranchReuse in work result report format", () => {
    const report = buildWorkResultReportFormatSections().join("\n");
    expect(report).toContain("workBranchReuse:");
    expect(report).toContain("origin work branch 존재 여부:");
  });
});
