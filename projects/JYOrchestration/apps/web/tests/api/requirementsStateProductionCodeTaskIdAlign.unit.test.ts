import { describe, expect, it } from "vitest";
import { CANONICAL_SAMPLE_DATA_CODE_TASK_ID, LEGACY_SAMPLE_DATA_CODE_TASK_ID } from "@/lib/prototype/codeTaskCanonicalId";
import { alignProductionCodeTaskIdsInRequirementsState } from "@/lib/prototype/requirementsStateProductionCodeTaskIdAlign";
import type { ImplementationCodeTaskPlanV1 } from "@/lib/prototype/implementationCodeTaskPlan";
import { SAMPLE_DATA_WORK_BRANCH } from "@/lib/prototype/sampleDataCodeTaskPlanner";

function planWithLegacySampleId(): ImplementationCodeTaskPlanV1 {
  return {
    version: "implementation_code_task_plan_v1",
    projectId: "p1",
    createdAt: "2026-06-09T00:00:00.000Z",
    updatedAt: "2026-06-09T00:00:00.000Z",
    source: "implementation_task_list",
    parentTaskCount: 1,
    codeTaskCount: 1,
    readiness: { ready: true, missing: [] },
    tasks: [
      {
        codeTaskId: LEGACY_SAMPLE_DATA_CODE_TASK_ID,
        parentTaskId: "DEV-MOCK-001",
        title: "샘플 데이터 구현",
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
          workBranch: SAMPLE_DATA_WORK_BRANCH,
          baseBranch: "wip/foundation/app-shell",
          executionMode: "sequential",
        },
      },
    ],
  };
}

describe("requirementsStateProductionCodeTaskIdAlign", () => {
  it("repairs legacy sample data id in plan and matching runs to canonical id", () => {
    const aligned = alignProductionCodeTaskIdsInRequirementsState({
      requirementsState: {
        implementationCodeTaskPlanV1: planWithLegacySampleId(),
        codeTaskExecutionRunsV1: [
          {
            version: "code_task_execution_run_v1",
            runId: "r1",
            projectId: "p1",
            processTaskId: "DEV-MOCK-001",
            workItemId: "w1",
            codeTaskId: LEGACY_SAMPLE_DATA_CODE_TASK_ID,
            status: "completed",
            attemptNo: 1,
            workBranch: SAMPLE_DATA_WORK_BRANCH,
            createdAt: "2026-06-12T00:00:00.000Z",
            updatedAt: "2026-06-12T00:00:00.000Z",
          },
        ],
      },
    });
    expect(aligned.codeTaskPlan?.tasks[0]?.codeTaskId).toBe(CANONICAL_SAMPLE_DATA_CODE_TASK_ID);
    expect(aligned.runs?.[0]?.codeTaskId).toBe(CANONICAL_SAMPLE_DATA_CODE_TASK_ID);
    expect(aligned.planRepaired || aligned.runsRepaired).toBe(true);
  });
});
