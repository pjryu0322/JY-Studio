import { describe, expect, it } from "vitest";
import { buildPrototypeExecutionOrchestrationPersistPatch } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { ImplementationStageActionRun } from "@/lib/prototype/implementationStageActionRun";
import { buildInitialImplementationTaskExecutionStateFromTaskList } from "@/lib/prototype/implementationTaskExecutionState";
import { buildMockImplementationQualityGateResult } from "@/lib/prototype/implementationQualityGate";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

const NOW = "2026-05-28T00:00:00.000Z";

function makeRun(runId: string): ImplementationStageActionRun {
  return {
    runId,
    projectId: "p1",
    actionId: "SHOW_ARTIFACTS",
    source: "cta",
    status: "succeeded",
    startedAt: NOW,
    completedAt: NOW,
    timelineEntries: [],
  };
}

describe("buildPrototypeExecutionOrchestrationPersistPatch", () => {
  it("persists implementationStageActionRunLogV1 in orchestration patch", () => {
    const run = makeRun("run-1");
    const patch = buildPrototypeExecutionOrchestrationPersistPatch(
      {},
      {
        implementationStageActionRunLogV1: {
          version: "implementation_stage_action_run_log_v1",
          runs: [run],
          updatedAt: NOW,
        },
      },
    );
    expect(patch.implementationStageActionRunLogV1?.runs[0]?.runId).toBe("run-1");
  });

  it("includes implementationTaskExecutionStateV1 in orchestration patch", () => {
    const seed: ImplementationSeedV1 = {
      version: "implementation_seed_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "planning_slots_and_artifacts",
      lifecycleStatus: "confirmed",
      readiness: { ready: true, score: 1, missing: [], warnings: [] },
      processImplementationItems: [],
      screenImplementationItems: [],
      actorCapabilityMatrix: [],
      commonDetailFeatures: [],
      dataModelSeed: { entities: [], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
      assumptions: [],
      gaps: [],
    };
    const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed, nowIso: NOW });
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    const patch = buildPrototypeExecutionOrchestrationPersistPatch({}, { implementationTaskExecutionStateV1: executionState });
    expect(patch.implementationTaskExecutionStateV1?.projectId).toBe("p1");
    expect(patch.implementationTaskExecutionStateV1?.items.length).toBeGreaterThan(0);
  });

  it("includes implementationQualityGateResultsV1 in orchestration patch", () => {
    const seed: ImplementationSeedV1 = {
      version: "implementation_seed_v1",
      projectId: "p1",
      createdAt: NOW,
      updatedAt: NOW,
      source: "planning_slots_and_artifacts",
      lifecycleStatus: "confirmed",
      readiness: { ready: true, score: 1, missing: [], warnings: [] },
      processImplementationItems: [],
      screenImplementationItems: [],
      actorCapabilityMatrix: [],
      commonDetailFeatures: [],
      dataModelSeed: { entities: [], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
      assumptions: [],
      gaps: [],
    };
    const taskList = buildImplementationTaskListFromSeed({ projectId: "p1", seed, nowIso: NOW });
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    const gate = buildMockImplementationQualityGateResult({
      role: "reviewer",
      taskList,
      executionState,
      nowIso: NOW,
    });
    const patch = buildPrototypeExecutionOrchestrationPersistPatch({}, {
      implementationQualityGateResultsV1: [gate],
    });
    expect(patch.implementationQualityGateResultsV1?.[0]?.role).toBe("reviewer");
  });
});

