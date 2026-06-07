import { describe, expect, it } from "vitest";
import {
  buildSemanticProductionCodeTaskId,
  isMockCodeTaskId,
  repairLegacyMockCodeTaskIdsInPlan,
  repairMockCodeTaskIdIfPossible,
} from "@/lib/prototype/codeTaskCanonicalId";
import { normalizeProductionCodeTaskPlan } from "@/lib/prototype/implementationCodeTaskPlanNormalizer";
import {
  prepareSelectedCodeTaskIdsForQuickRun,
} from "@/lib/prototype/implementationTaskTreeCodeTaskSelection";
import { buildCodeTaskFileConflictPlan, blockingIssuesForCodeTaskExecute } from "@/lib/prototype/codeTaskFileConflictPlanner";
import { CODE_TASK_FILE_BOUNDARY_VERSION } from "@/lib/prototype/codeTaskFileBoundary";
import { runWorkItemPreflight } from "@/lib/prototype/implementationWorkItemPreflight";
import type { ImplementationCodeTaskV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import type { CursorWorkItem } from "@/lib/prototype/implementationCursorWorkItems";

const MOCK = "CODE-DEV-MOCK-001-001";
const SAMPLE = "CODE-DEV-SAMPLE-DATA-001-001";

function dataTask(codeTaskId: string): ImplementationCodeTaskV1 {
  return {
    codeTaskId,
    parentTaskId: "DEV-SAMPLE-DATA-001",
    title: "샘플 데이터 생성",
    description: "sample",
    changeType: "data",
    targetHints: ["data"],
    acceptanceCriteria: ["ok"],
    verificationHints: ["verify"],
    forbiddenPaths: ["forbidden"],
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
    codeTaskId: "CODE-DEV-FRAME-001-001",
    parentTaskId: "DEV-FRAME-001",
    title: "Frame",
    description: "frame",
    changeType: "component",
    targetHints: ["shell"],
    acceptanceCriteria: ["ok"],
    verificationHints: ["verify"],
    forbiddenPaths: ["forbidden"],
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

describe("P3-M60 block mock CodeTask IDs at planning boundary", () => {
  it("buildSemanticProductionCodeTaskId uses SAMPLE-DATA for mock task type", () => {
    expect(
      buildSemanticProductionCodeTaskId({
        parentTaskId: "DEV-MOCK-001",
        sequence: 1,
        taskType: "mock",
        title: "샘플 데이터 생성",
      }),
    ).toBe(SAMPLE);
  });

  it("repairMockCodeTaskIdIfPossible maps mock to canonical sample-data id", () => {
    const repair = repairMockCodeTaskIdIfPossible({
      codeTaskId: MOCK,
      title: "샘플 데이터 생성",
      branchGroup: "data",
      workBranch: "wip/data/sample-data",
      existingCodeTaskIds: [MOCK],
    });
    expect(repair.status).toBe("repaired");
    if (repair.status === "repaired") {
      expect(repair.toCodeTaskId).toBe(SAMPLE);
    }
  });

  it("normalizeProductionCodeTaskPlan repairs mock ids in plan tasks", () => {
    const plan = normalizeProductionCodeTaskPlan({
      plan: {
        version: "implementation_code_task_plan_v1",
        projectId: "p1",
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-04T00:00:00.000Z",
        source: "implementation_task_list",
        parentTaskCount: 1,
        codeTaskCount: 1,
        tasks: [dataTask(MOCK)],
      },
    });
    expect(plan.plan.tasks[0]?.codeTaskId).toBe(SAMPLE);
    expect(isMockCodeTaskId(plan.plan.tasks[0]?.codeTaskId ?? "")).toBe(false);
  });

  it("work item preflight fails on mock codeTaskId", () => {
    const workItem: CursorWorkItem = {
      id: "wi-1",
      taskId: "DEV-MOCK-001",
      codeTaskId: MOCK,
      objective: "obj",
      expectedChange: "change",
      originStage: "planning",
      refinementStatus: "draft",
    };
    const result = runWorkItemPreflight({ workItem });
    expect(result.status).toBe("failed");
  });

  it("does not block data execute when foundation forbids data path peer overlap", () => {
    const tasks = [foundationTask(), dataTask(SAMPLE)];
    const plan = buildCodeTaskFileConflictPlan(tasks);
    const blocking = blockingIssuesForCodeTaskExecute({
      plan,
      codeTask: dataTask(SAMPLE),
      allTasks: tasks,
    });
    expect(blocking.some((i) => i.filePath.includes("sample"))).toBe(false);
  });

  it("repairLegacyMockCodeTaskIdsInPlan remaps dependencies", () => {
    const frame = foundationTask();
    const mock = dataTask(MOCK);
    const repaired = repairLegacyMockCodeTaskIdsInPlan([frame, mock]);
    expect(repaired.some((t) => isMockCodeTaskId(t.codeTaskId))).toBe(false);
  });

  it("prepareSelectedCodeTaskIdsForQuickRun repairs mock selection when plan is canonical", () => {
    const tasks = [foundationTask(), dataTask(SAMPLE)];
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: "p1",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
      source: "implementation_task_list" as const,
      parentTaskCount: 2,
      codeTaskCount: 2,
      tasks,
    };
    const prep = prepareSelectedCodeTaskIdsForQuickRun({
      codeTaskPlan: plan,
      selectedCodeTaskIds: [MOCK, "CODE-DEV-FRAME-001-001"],
    });
    expect(prep.status).toBe("ok");
    if (prep.status === "ok") {
      expect(prep.selectedCodeTaskIds).toContain(SAMPLE);
      expect(prep.selectedCodeTaskIds).not.toContain(MOCK);
      expect(prep.repairs.length).toBeGreaterThan(0);
    }
  });

  it("prepareSelectedCodeTaskIdsForQuickRun blocks when mock remains in plan", () => {
    const plan = {
      version: "implementation_code_task_plan_v1" as const,
      projectId: "p1",
      createdAt: "2026-06-04T00:00:00.000Z",
      updatedAt: "2026-06-04T00:00:00.000Z",
      source: "implementation_task_list" as const,
      parentTaskCount: 1,
      codeTaskCount: 1,
      tasks: [dataTask(MOCK)],
    };
    const prep = prepareSelectedCodeTaskIdsForQuickRun({
      codeTaskPlan: plan,
      selectedCodeTaskIds: [MOCK],
    });
    expect(prep.status).toBe("blocked");
  });
});
