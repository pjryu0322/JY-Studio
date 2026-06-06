import { describe, expect, it } from "vitest";
import { classifyCodeTaskBranchGroup } from "@/lib/prototype/codeTaskBranchGroupPlanner";
import {
  buildImplementationBranchPlan,
  isCodeTaskRunnableByBranchPlan,
  sortCodeTaskIdsByBranchPlan,
} from "@/lib/prototype/implementationBranchPlanBuilder";
import { buildFileBoundaryForRole } from "@/lib/prototype/codeTaskFileBoundaryPlanner";
import { buildCodeTaskDeveloperPromptDetailed } from "@/lib/prototype/buildCodeTaskDeveloperPrompt";
import { DEFAULT_BRANCH_PLAN_EXECUTION_ORDER } from "@/lib/prototype/implementationBranchPlan";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { findNextRunnableCodeTaskIdInSelection } from "@/lib/prototype/implementationRuntimeQueueModel";

const NOW = "2026-06-03T12:00:00.000Z";

function task(codeTaskId: string, title: string, role: Parameters<typeof buildFileBoundaryForRole>[0]): ImplementationCodeTaskV1 {
  return {
    codeTaskId,
    parentTaskId: "DEV-1",
    title,
    description: title,
    changeType: "component",
    targetHints: ["h"],
    dependencies: [],
    acceptanceCriteria: ["ok"],
    verificationHints: ["v"],
    forbiddenPaths: ["x"],
    priority: "P1",
    status: "ready",
    blockers: [],
    fileBoundary: buildFileBoundaryForRole(role, title),
  };
}

describe("P3-M46 branch plan during planning", () => {
  it("classifies branch groups by role", () => {
    expect(classifyCodeTaskBranchGroup({ codeTask: task("A", "Shell", "app_shell") })).toBe("foundation");
    expect(classifyCodeTaskBranchGroup({ codeTask: task("B", "샘플 데이터", "mock_data") })).toBe("data");
    expect(classifyCodeTaskBranchGroup({ codeTask: task("C", "로딩 상태", "common_loading") })).toBe("common");
    expect(classifyCodeTaskBranchGroup({ codeTask: task("D", "기능 시작", "feature_start") })).toBe("feature");
    expect(classifyCodeTaskBranchGroup({ codeTask: task("E", "결과 화면", "screen_result") })).toBe("screen");
  });

  it("builds branch chain with sequential base branches", () => {
    const tasks = [
      task("T1", "화면 프레임/앱 Shell", "app_shell"),
      task("T2", "샘플 데이터", "mock_data"),
      task("T3", "로딩 상태", "common_loading"),
    ];
    const built = buildImplementationBranchPlan({
      projectId: "p1",
      baseBranch: "main",
      codeTasks: tasks,
      nowIso: NOW,
    });
    expect(built.branchPlan.executionOrder).toEqual([...DEFAULT_BRANCH_PLAN_EXECUTION_ORDER]);
    const dataTask = built.codeTasks.find((t) => t.codeTaskId === "T2");
    expect(dataTask?.branchPlan?.baseBranch).toBe("wip/foundation/app-shell");
    expect(dataTask?.branchPlan?.workBranch).toBe("wip/data/sample-data");
    const commonTask = built.codeTasks.find((t) => t.codeTaskId === "T3");
    expect(commonTask?.branchPlan?.baseBranch).toBe("wip/data/sample-data");
  });

  it("sorts selected ids by branch plan execution order", () => {
    const built = buildImplementationBranchPlan({
      projectId: "p1",
      baseBranch: "main",
      codeTasks: [
        task("T3", "로딩 상태", "common_loading"),
        task("T1", "Shell", "app_shell"),
        task("T2", "샘플 데이터", "mock_data"),
      ],
      nowIso: NOW,
    });
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_task_list" as const,
      parentTaskCount: 1,
      codeTaskCount: 3,
      tasks: built.codeTasks,
      readiness: { ready: true, missing: [] },
      implementationBranchPlanV1: built.branchPlan,
    };
    expect(sortCodeTaskIdsByBranchPlan(plan, ["T3", "T2", "T1"])).toEqual(["T1", "T2", "T3"]);
  });

  it("includes Branch Plan section in developer prompt", () => {
    const built = buildImplementationBranchPlan({
      projectId: "p1",
      baseBranch: "main",
      codeTasks: [task("T1", "로딩 상태", "common_loading")],
      nowIso: NOW,
    });
    const codeTask = built.codeTasks[0]!;
    const { prompt } = buildCodeTaskDeveloperPromptDetailed({
      codeTask,
      targetRepository: { gitRepoUrl: "https://github.com/o/r", repoFullName: "o/r", provider: "github" },
      baseBranch: "main",
      targetRepoKind: "generated_project",
    });
    expect(prompt).toContain("## Branch Plan");
    expect(prompt).toContain("wip/common/components");
    expect(prompt).toContain("`main` 기준이 아니라");
  });

  it("blocks next branch group until prior selected tasks complete", () => {
    const built = buildImplementationBranchPlan({
      projectId: "p1",
      baseBranch: "main",
      codeTasks: [
        task("T1", "Shell", "app_shell"),
        task("T2", "샘플", "mock_data"),
      ],
      nowIso: NOW,
    });
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "implementation_task_list" as const,
      parentTaskCount: 1,
      codeTaskCount: 2,
      tasks: built.codeTasks,
      readiness: { ready: true, missing: [] },
      implementationBranchPlanV1: built.branchPlan,
    };
    const selected = ["T1", "T2"];
    expect(
      isCodeTaskRunnableByBranchPlan({
        codeTaskPlan: plan,
        selectedCodeTaskIds: selected,
        codeTaskId: "T2",
        runs: [],
      }),
    ).toBe(false);
    expect(
      findNextRunnableCodeTaskIdInSelection({
        selectedCodeTaskIds: selected,
        afterCodeTaskId: "T1",
        runs: [
          {
            runId: "r1",
            codeTaskId: "T1",
            status: "completed",
            createdAt: NOW,
            updatedAt: NOW,
          },
        ],
        codeTaskPlan: plan,
      }),
    ).toBe("T2");
  });
});
