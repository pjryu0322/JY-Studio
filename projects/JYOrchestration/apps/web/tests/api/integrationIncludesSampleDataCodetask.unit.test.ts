import { describe, expect, it } from "vitest";
import {
  ensureSampleDataCodeTaskIncludedInSelection,
  SAMPLE_DATA_CODE_TASK_ID,
} from "@/lib/prototype/sampleDataCodeTaskPlanner";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";

function minimalPlan(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: "2026-06-09T00:00:00.000Z",
    updatedAt: "2026-06-09T00:00:00.000Z",
    source: "implementation_task_list",
    parentTaskCount: 2,
    codeTaskCount: 2,
    readiness: { ready: true, missing: [] },
    tasks: [
      {
        codeTaskId: SAMPLE_DATA_CODE_TASK_ID,
        parentTaskId: "DEV-MOCK-001",
        title: "회의록 자동정리 샘플데이터 구성 · 샘플 데이터 구현",
        description: "sample",
        changeType: "data",
        targetHints: ["data"],
        dependencies: [],
        acceptanceCriteria: ["ok"],
        verificationHints: ["verify"],
        forbiddenPaths: ["forbidden"],
        priority: "P0",
        status: "ready",
        blockers: [],
        branchPlan: {
          branchGroup: "data",
          workBranch: "wip/data/sample-data",
          baseBranch: "wip/foundation/app-shell",
          executionMode: "sequential",
        },
      },
      {
        codeTaskId: "CODE-DEV-SCREEN-001-001",
        parentTaskId: "DEV-SCREEN-001",
        title: "화면 A · 화면 구현",
        description: "screen",
        changeType: "component",
        targetHints: ["components"],
        dependencies: ["DEV-MOCK-001"],
        parentTaskDependencies: ["DEV-MOCK-001"],
        acceptanceCriteria: ["ok"],
        verificationHints: ["verify"],
        forbiddenPaths: ["forbidden"],
        priority: "P1",
        status: "ready",
        blockers: [],
      },
    ],
  };
}

describe("integrationIncludesSampleDataCodetask", () => {
  it("auto-includes sample data CodeTask when a screen CodeTask is selected", () => {
    const merged = ensureSampleDataCodeTaskIncludedInSelection({
      codeTaskPlan: minimalPlan(),
      selectedCodeTaskIds: ["CODE-DEV-SCREEN-001-001"],
    });
    expect(merged).toContain(SAMPLE_DATA_CODE_TASK_ID);
    expect(merged).toContain("CODE-DEV-SCREEN-001-001");
  });

  it("leaves selection unchanged when only sample data is selected", () => {
    const merged = ensureSampleDataCodeTaskIncludedInSelection({
      codeTaskPlan: minimalPlan(),
      selectedCodeTaskIds: [SAMPLE_DATA_CODE_TASK_ID],
    });
    expect(merged).toEqual([SAMPLE_DATA_CODE_TASK_ID]);
  });
});
