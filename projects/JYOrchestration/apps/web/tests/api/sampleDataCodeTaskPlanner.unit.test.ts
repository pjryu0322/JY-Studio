import { describe, expect, it } from "vitest";
import {
  buildImplementationCodeTaskPlanFromTaskList,
} from "@/lib/prototype/implementationCodeTaskPlan";
import {
  SAMPLE_DATA_CODE_TASK_ID,
  SAMPLE_DATA_PARENT_PROCESS_TASK_ID,
  listSampleDataCodeTaskIdsFromPlan,
} from "@/lib/prototype/sampleDataCodeTaskPlanner";
import { buildSemanticProductionCodeTaskId } from "@/lib/prototype/codeTaskCanonicalId";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

const PROJECT_ID = "p-sample-data";
const NOW = "2026-06-09T00:00:00.000Z";

function makeSeed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: PROJECT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    source: "planning_slots_and_artifacts",
    lifecycleStatus: "confirmed",
    readiness: { ready: true, score: 1, missing: [], warnings: [] },
    processImplementationItems: [
      {
        id: "proc-1",
        processName: "회의록 정리",
        actors: ["user"],
        screens: ["workspace"],
        actions: ["upload"],
        dataTouched: ["meeting"],
        exceptions: [],
      },
    ],
    screenImplementationItems: [
      {
        id: "screen-1",
        screenName: "회의록 workspace",
        accessibleActors: ["user"],
        actions: ["view"],
        visibleData: ["summary"],
        editableData: [],
        states: ["ready"],
      },
    ],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [],
    dataModelSeed: {
      entities: ["Meeting"],
      fieldsByEntity: { Meeting: ["id"] },
      relationships: [],
      mockDataNotes: [],
    },
  };
}

describe("sampleDataCodeTaskPlanner", () => {
  it("creates CODE-DATA-SAMPLE-001 for mock parent task", () => {
    expect(
      buildSemanticProductionCodeTaskId({
        parentTaskId: SAMPLE_DATA_PARENT_PROCESS_TASK_ID,
        sequence: 1,
        taskType: "mock",
        title: "회의록 자동정리 샘플데이터 구성",
      }),
    ).toBe(SAMPLE_DATA_CODE_TASK_ID);
  });

  it("includes sample data CodeTask in meeting-minutes task list plan", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: PROJECT_ID,
      seed: makeSeed(),
      nowIso: NOW,
    });
    const mockTask = taskList.tasks.find((t) => t.taskId === SAMPLE_DATA_PARENT_PROCESS_TASK_ID);
    expect(mockTask?.taskType).toBe("mock");
    expect(mockTask?.title).toContain("샘플데이터");

    const plan = buildImplementationCodeTaskPlanFromTaskList({
      projectId: PROJECT_ID,
      taskList,
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    const sampleIds = listSampleDataCodeTaskIdsFromPlan(plan, taskList);
    expect(sampleIds).toContain(SAMPLE_DATA_CODE_TASK_ID);
    const sampleTask = plan.tasks.find((t) => t.codeTaskId === SAMPLE_DATA_CODE_TASK_ID);
    expect(sampleTask?.changeType).toBe("data");
    expect(sampleIds.length).toBeGreaterThan(0);
  });
});
