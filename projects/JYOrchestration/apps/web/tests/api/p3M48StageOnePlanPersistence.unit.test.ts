import { describe, expect, it } from "vitest";
import { buildFileBoundaryForRole } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import {
  INTEGRATION_WIRING_CODE_TASK_ID,
  buildIntegrationWiringCodeTask,
  resolveCodeTaskPlanAggregateCounts,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { prepareCodeTaskPlanForStageOnePrompt } from "@/lib/prototype/prepareCodeTaskPlanForStageOnePrompt";
import { resolveCodeTaskCanonicalSlug, slugContainsHangul } from "@/lib/prototype/codeTaskSlug";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import {
  buildImplementationCodeTaskPlanFromTaskList,
  type ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import { buildBranchPlanGroupListingSections } from "@/lib/prototype/codeTaskStageOnePromptSections";
import {
  codeTaskHasPersistedBranchPlan,
  codeTaskHasPersistedFileBoundary,
  evaluateStageOnePromptPlanReadiness,
  integrationTaskIsLast,
} from "@/lib/prototype/stageOnePromptReadiness";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T18:00:00.000Z";
const PID = "p-m48";

function meetingTaskList(): ImplementationTaskListV1 {
  const tasks = [
    { taskId: "DEV-FRAME-001", title: "화면 프레임/앱 Shell 구성", taskType: "feature" as const },
    { taskId: "DEV-MOCK-001", title: "샘플 데이터 생성", taskType: "feature" as const },
    { taskId: "DEV-COMMON-001", title: "로딩 상태 공통 기능 구현", taskType: "feature" as const },
    { taskId: "DEV-FEATURE-001", title: "시작 기능 구현", taskType: "feature" as const },
    { taskId: "DEV-FEATURE-002", title: "업무 입력 기능 구현", taskType: "feature" as const },
    { taskId: "DEV-SCREEN-001", title: "입력 화면 화면 구현", taskType: "screen" as const },
    { taskId: "DEV-SCREEN-002", title: "결과 화면 화면 구현", taskType: "screen" as const },
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

describe("P3-M48 prepareCodeTaskPlanForStageOnePrompt", () => {
  it("persists branchPlan and fileBoundary on all tasks including integration last", () => {
    const list = meetingTaskList();
    const raw = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const stripped = {
      ...raw,
      tasks: raw.tasks.map((t) => ({
        ...t,
        branchPlan: undefined,
        fileBoundary: undefined,
      })),
      implementationBranchPlanV1: null,
    };
    const prepared = prepareCodeTaskPlanForStageOnePrompt({
      projectId: PID,
      baseBranch: "main",
      plan: stripped,
      taskList: list,
      nowIso: NOW,
    });
    expect(prepared.plan.tasks.length).toBeGreaterThanOrEqual(raw.tasks.length);
    expect(integrationTaskIsLast(prepared.plan)).toBe(true);
    const execTotal = resolveCodeTaskPlanAggregateCounts(prepared.plan.tasks).executableCodeTaskCount;
    expect(prepared.plan.codeTaskCount).toBe(execTotal);
    expect(prepared.readiness.branchPlanCount).toBe(execTotal);
    expect(prepared.readiness.fileBoundaryCount).toBe(execTotal);
    expect(prepared.readiness.ready).toBe(true);
    for (const ct of prepared.plan.tasks) {
      expect(codeTaskHasPersistedBranchPlan(ct)).toBe(true);
      expect(codeTaskHasPersistedFileBoundary(ct)).toBe(true);
    }
    const groupSection = buildBranchPlanGroupListingSections(prepared.plan).join("\n");
    expect(groupSection).toContain("### foundation");
    expect(groupSection).not.toContain(INTEGRATION_WIRING_CODE_TASK_ID);
    expect(prepared.plan.tasks.some((t) => t.codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID)).toBe(true);
  });

  it("integration task uses final wiring content not app shell rewrite", () => {
    const wiring = buildIntegrationWiringCodeTask({
      projectId: PID,
      parentTaskId: "DEV-INTEGRATION-001",
      dependsOnCodeTaskId: "X",
      envOk: true,
      designOk: true,
    });
    expect(wiring.acceptanceCriteria.join(" ")).toContain("연결");
    expect(wiring.acceptanceCriteria.join(" ")).not.toMatch(/3열 workspace shell/i);
    expect(wiring.description).toContain("App Shell");
  });

  it("uses english slug file boundaries for feature and screen ids", () => {
    const feature = buildFileBoundaryForRole("feature_start", {
      codeTaskId: "CODE-DEV-FEATURE-001-001",
      title: "시작 기능 구현",
    });
    expect(feature.ownedFiles[0]).toContain("StartFlow");
    expect(slugContainsHangul(feature.ownedFiles[0]!)).toBe(false);

    const screenA = buildFileBoundaryForRole("screen_input", {
      codeTaskId: "CODE-DEV-SCREEN-001-001",
      title: "입력 화면 화면 구현",
    });
    const screenB = buildFileBoundaryForRole("screen_result", {
      codeTaskId: "CODE-DEV-SCREEN-002-001",
      title: "결과 화면 화면 구현",
    });
    expect(screenA.ownedFiles.join(" ")).toContain("InputScreen");
    expect(screenB.ownedFiles.join(" ")).toContain("ResultScreen");
    expect(screenA.ownedFiles).not.toEqual(screenB.ownedFiles);
  });

  it("developer prompt inherits branchPlan base and work branches", () => {
    const list = meetingTaskList();
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const common = plan.tasks.find((t) => t.branchPlan?.branchGroup === "common");
    expect(common?.branchPlan?.workBranch).toMatch(/^wip\//);
    expect(common?.branchPlan?.baseBranch).toMatch(/^wip\//);
    const { prompt } = buildCodeTaskDeveloperPromptDetailed({
      codeTask: common!,
      targetRepository: { gitRepoUrl: "https://github.com/o/r", repoFullName: "o/r", provider: "github" },
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    expect(prompt).toContain(common!.branchPlan!.workBranch);
    expect(prompt).toContain(common!.branchPlan!.baseBranch);
    expect(prompt).not.toContain("wip/cursor/code-dev");
  });
});

describe("P3-M48 readiness", () => {
  it("marks plan without branchPlan as blocking", () => {
    const task: ImplementationCodeTaskV1 = {
      codeTaskId: "T1",
      parentTaskId: "P1",
      title: "t",
      description: "",
      changeType: "component",
      acceptanceCriteria: [],
      verificationHints: [],
      forbiddenPaths: [],
      priority: "P1",
      status: "ready",
      blockers: [],
    };
    const readiness = evaluateStageOnePromptPlanReadiness({
      plan: {
        version: "implementation_code_task_plan_v1",
        projectId: PID,
        createdAt: NOW,
        updatedAt: NOW,
        source: "implementation_task_list",
        parentTaskCount: 1,
        codeTaskCount: 1,
        tasks: [task],
        readiness: { ready: false, missing: [] },
      },
    });
    expect(readiness.blocking).toBe(true);
    expect(readiness.ready).toBe(false);
  });

  it("resolveCodeTaskCanonicalSlug maps known ids", () => {
    expect(
      resolveCodeTaskCanonicalSlug({
        codeTaskId: "CODE-DEV-SCREEN-003-001",
        title: "관리 화면",
        roleKind: "screen_admin",
      }),
    ).toBe("AdminScreen");
  });
});
