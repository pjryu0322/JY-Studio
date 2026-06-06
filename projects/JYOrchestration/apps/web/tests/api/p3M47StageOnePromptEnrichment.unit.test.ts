import { describe, expect, it } from "vitest";
import { buildCodeTaskPromptContextMap } from "@/lib/prototype/buildCodeTaskPromptContext";
import { buildFileBoundaryForRole } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import {
  appendIntegrationWiringCodeTaskToPlan,
  INTEGRATION_WIRING_CODE_TASK_ID,
  planHasIntegrationWiringCodeTask,
} from "@/lib/prototype/codeTaskIntegrationWiringTask";
import { evaluateCodeTaskPromptCollisionReadiness } from "@/lib/prototype/codeTaskPromptQualityGate";
import {
  buildBranchPlanSummarySections,
  STAGE_ONE_CONFLICT_PREVENTION_POLICY_LINES,
} from "@/lib/prototype/codeTaskStageOnePromptSections";
import { formatCodeTaskPromptDraftBundle } from "@/lib/prototype/formatCodeTaskPromptDraft";
import {
  buildImplementationCodeTaskPlanFromTaskList,
  type ImplementationCodeTaskV1,
} from "@/lib/prototype/implementationCodeTaskPlan";
import type { ImplementationTaskListV1 } from "@/lib/requirements/implementationTaskList";

const NOW = "2026-06-04T12:00:00.000Z";
const PID = "p-m47";

function shellTask(): ImplementationCodeTaskV1 {
  return {
    codeTaskId: "T-SHELL",
    parentTaskId: "DEV-1",
    title: "화면 프레임/앱 Shell 구성",
    description: "Shell",
    changeType: "component",
    targetHints: ["shell"],
    dependencies: [],
    acceptanceCriteria: ["ok", "ok2", "ok3"],
    verificationHints: ["v1", "v2"],
    forbiddenPaths: ["package.json"],
    priority: "P0",
    status: "ready",
    blockers: [],
    fileBoundary: buildFileBoundaryForRole("app_shell", "Shell"),
    branchPlan: {
      branchGroup: "foundation",
      workBranch: "wip/foundation/app-shell",
      baseBranch: "main",
      baseBranchPolicy: "main",
      executionMode: "sequential",
    },
  };
}

describe("P3-M47 stage-one prompt enrichment", () => {
  it("includes branch plan summary and conflict policy in bundle", () => {
    const task = shellTask();
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: PID,
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_task_list" as const,
      parentTaskCount: 1,
      codeTaskCount: 1,
      tasks: [task],
      readiness: { ready: true, missing: [] },
      implementationBranchPlanV1: {
        version: "implementation_branch_plan_v1" as const,
        projectId: PID,
        baseBranch: "main",
        createdAt: NOW,
        executionOrder: ["foundation"],
        groups: [
          {
            groupId: "foundation" as const,
            title: "Foundation",
            workBranch: "wip/foundation/app-shell",
            baseBranch: "main",
            codeTaskIds: ["T-SHELL"],
            policy: "sequential" as const,
            ownedFiles: [],
            forbiddenFiles: [],
            conflictGroupIds: [],
          },
        ],
      },
    };
    const map = buildCodeTaskPromptContextMap({
      projectId: PID,
      codeTaskPlan: plan,
      requirementsStateJson: {},
      nowIso: NOW,
    });
    const bundle = formatCodeTaskPromptDraftBundle({
      codeTaskPlan: plan,
      taskList: null,
      promptContextMap: map,
    });
    expect(bundle).toContain("## Branch Plan 요약");
    expect(bundle).toContain("## 충돌 예방 정책");
    expect(STAGE_ONE_CONFLICT_PREVENTION_POLICY_LINES.some((l) => l.includes("WorkspaceShell"))).toBe(
      true,
    );
    expect(buildBranchPlanSummarySections(plan).join("\n")).toContain("foundation");
    expect(bundle).toContain("#### Branch Plan");
    expect(bundle).toContain("#### File Boundary");
    expect(bundle).toContain("##### 수정 허용 파일");
    expect(bundle).toContain("##### 수정 금지 파일");
  });

  it("appends integration wiring task once", () => {
    const basePlan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: PID,
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_task_list" as const,
      parentTaskCount: 1,
      codeTaskCount: 1,
      tasks: [shellTask()],
      readiness: { ready: true, missing: [] },
    };
    const once = appendIntegrationWiringCodeTaskToPlan({ plan: basePlan });
    expect(planHasIntegrationWiringCodeTask(once.tasks)).toBe(true);
    expect(once.tasks.some((t) => t.codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID)).toBe(true);
    const twice = appendIntegrationWiringCodeTaskToPlan({ plan: once });
    expect(twice.tasks.length).toBe(once.tasks.length);
    const integration = once.tasks.find((t) => t.codeTaskId === INTEGRATION_WIRING_CODE_TASK_ID)!;
    expect(integration.changeType).toBe("integration");
  });

  it("marks missing branchPlan as not ready in collision gate", () => {
    const task = { ...shellTask(), branchPlan: undefined };
    const collision = evaluateCodeTaskPromptCollisionReadiness({ codeTask: task });
    expect(collision.missing).toContain("branchPlan");
  });

  it("developer prompt inherits branch and file boundary", () => {
    const task = shellTask();
    const { prompt } = buildCodeTaskDeveloperPromptDetailed({
      codeTask: task,
      targetRepository: { gitRepoUrl: "https://github.com/o/r", repoFullName: "o/r", provider: "github" },
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    expect(prompt).toContain("## Branch Plan");
    expect(prompt).toContain("## 수정 허용 파일");
    expect(prompt).toContain("wip/foundation/app-shell");
    expect(prompt).not.toContain("src/** 전체");
  });
});

describe("P3-M47 integration task from task list plan", () => {
  it("buildImplementationCodeTaskPlanFromTaskList includes integration wiring", () => {
    const list: ImplementationTaskListV1 = {
      version: 1,
      projectId: PID,
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_seed_v1",
      tasks: [
        {
          taskId: "DEV-F",
          title: "화면 프레임/앱 Shell 구성",
          description: "Shell",
          taskType: "feature",
          ownerRole: "developer",
          priority: "high",
          status: "ready",
          dependencies: [],
          acceptanceCriteria: ["a", "b", "c"],
          sourceRefs: [],
        },
      ],
      roleSummary: { developer: 1, designer: 0, reviewer: 0, security: 0, scm: 0 },
    };
    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PID,
      taskList: list,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    expect(planHasIntegrationWiringCodeTask(plan.tasks)).toBe(true);
  });
});
