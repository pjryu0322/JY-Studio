import { describe, expect, it } from "vitest";
import {
  buildCodeTaskFileConflictPlan,
  blockingIssuesForCodeTask,
  blockingIssuesForCodeTaskExecute,
  resolveCodeTaskConflictPlanForExecution,
  storedConflictPlanHasStaleForbiddenBlocking,
} from "@/lib/prototype/codeTaskFileConflictPlanner";
import { ensureCodeTaskPlanWithFileBoundaries } from "@/lib/prototype/codeTaskPlanRepairService";
import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";
import type { CodeTaskConflictPlanV1 } from "@/lib/prototype/codeTaskFileConflictPlanner";
import type { ImplementationCodeTaskPlanV1, ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";

const SAMPLE = "CODE-DATA-SAMPLE-001";
const FRAME = "CODE-DEV-FRAME-001-001";

function dataTask(): ImplementationCodeTaskV1 {
  return {
    codeTaskId: SAMPLE,
    parentTaskId: "DEV-SAMPLE-DATA-001",
    title: "샘플 데이터 생성",
    description: "sample",
    changeType: "data",
    targetHints: ["data"],
    acceptanceCriteria: ["ok"],
    verificationHints: ["verify"],
    forbiddenPaths: [],
    branchPlan: {
      branchGroup: "data",
      workBranch: "wip/data/sample-data",
      baseBranch: "wip/foundation/app-shell",
      executionMode: "sequential",
    },
    fileBoundary: {
      version: CODE_TASK_FILE_BOUNDARY_VERSION,
      expectedFiles: ["src/data/sample/*"],
      ownedFiles: ["src/data/sample/*"],
      forbiddenFiles: ["src/components/WorkspaceShell.*"],
    },
  };
}

function foundationTask(): ImplementationCodeTaskV1 {
  return {
    codeTaskId: FRAME,
    parentTaskId: "DEV-FRAME-001",
    title: "Frame",
    description: "frame",
    changeType: "component",
    targetHints: ["shell"],
    acceptanceCriteria: ["ok"],
    verificationHints: ["verify"],
    forbiddenPaths: [],
    branchPlan: {
      branchGroup: "foundation",
      workBranch: "wip/foundation/app-shell",
      baseBranch: "main",
      executionMode: "sequential",
    },
    fileBoundary: {
      version: CODE_TASK_FILE_BOUNDARY_VERSION,
      expectedFiles: ["src/components/WorkspaceShell.*"],
      ownedFiles: ["src/components/WorkspaceShell.*"],
      forbiddenFiles: ["src/data/sample/*"],
    },
  };
}

function staleForbiddenBlockingPlan(tasks: readonly ImplementationCodeTaskV1[]): CodeTaskConflictPlanV1 {
  return {
    issues: [
      {
        issueId: "stale:forbidden",
        severity: "blocking",
        reason: "forbidden_file_violation",
        filePath: "src/data/sample/*",
        codeTaskIds: [SAMPLE, FRAME],
        recommendation: "restrict_file_boundary",
      },
    ],
    conflictGroups: [],
    dependencyPatches: [],
  };
}

describe("P3-M62 wire boundary mirror into execution gate", () => {
  it("fresh conflict plan never blocking-forbidden on data/foundation sample mirror", () => {
    const tasks = [foundationTask(), dataTask()];
    const plan = buildCodeTaskFileConflictPlan(tasks);
    expect(
      plan.issues.some(
        (i) => i.severity === "blocking" && i.filePath.includes("sample"),
      ),
    ).toBe(false);
    expect(
      blockingIssuesForCodeTaskExecute({
        plan,
        codeTask: dataTask(),
        allTasks: tasks,
      }),
    ).toEqual([]);
  });

  it("blockingIssuesForCodeTaskExecute filters stale mirror blocking issues", () => {
    const tasks = [foundationTask(), dataTask()];
    const stale = staleForbiddenBlockingPlan(tasks);
    expect(storedConflictPlanHasStaleForbiddenBlocking(stale)).toBe(true);
    expect(blockingIssuesForCodeTask(stale, SAMPLE).length).toBe(1);
    expect(
      blockingIssuesForCodeTaskExecute({
        plan: stale,
        codeTask: dataTask(),
        allTasks: tasks,
      }),
    ).toEqual([]);
  });

  it("resolveCodeTaskConflictPlanForExecution rebuilds stale plan", () => {
    const tasks = [foundationTask(), dataTask()];
    const codeTaskPlan: ImplementationCodeTaskPlanV1 = {
      version: "implementation_code_task_plan_v1",
      projectId: "p1",
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      source: "implementation_task_list",
      parentTaskCount: 2,
      codeTaskCount: 2,
      tasks: [...tasks],
      codeTaskConflictPlanV1: staleForbiddenBlockingPlan(tasks),
    };
    const resolved = resolveCodeTaskConflictPlanForExecution({
      codeTask: dataTask(),
      codeTaskPlan,
      storedConflictPlan: codeTaskPlan.codeTaskConflictPlanV1,
    });
    expect(resolved.repairMeta?.reason).toBe("expected_owner_forbidden_mirror_reclassified");
    expect(resolved.repairMeta?.removedBlockingIssueCount).toBeGreaterThan(0);
    expect(
      blockingIssuesForCodeTaskExecute({
        plan: resolved.conflictPlan,
        codeTask: dataTask(),
        allTasks: tasks,
      }),
    ).toEqual([]);
  });

  it("ensureCodeTaskPlanWithFileBoundaries recomputes stale conflict plan without full repair", () => {
    const tasks = [foundationTask(), dataTask()];
    const plan: ImplementationCodeTaskPlanV1 = {
      version: "implementation_code_task_plan_v1",
      projectId: "p1",
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      source: "implementation_task_list",
      parentTaskCount: 2,
      codeTaskCount: 2,
      tasks: [...tasks],
      codeTaskConflictPlanV1: staleForbiddenBlockingPlan(tasks),
    };
    const ensured = ensureCodeTaskPlanWithFileBoundaries({ plan });
    expect(ensured?.codeTaskConflictPlanV1).not.toBe(plan.codeTaskConflictPlanV1);
    expect(storedConflictPlanHasStaleForbiddenBlocking(ensured?.codeTaskConflictPlanV1)).toBe(
      false,
    );
  });
});
