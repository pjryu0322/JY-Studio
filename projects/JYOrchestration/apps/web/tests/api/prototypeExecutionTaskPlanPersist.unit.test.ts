import { describe, expect, it } from "vitest";
import { buildInitialCodeAgentWipExecution } from "@/lib/prototype/codeAgentWipExecution";
import { buildImplementationTaskPlan } from "@/lib/prototype/implementationTaskPlan";
import { buildCursorWorkItemsFromImplementationTaskPlan } from "@/lib/prototype/implementationCursorWorkItems";
import { buildPrototypeExecutionOrchestrationPersistPatch } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
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

  it("includes codeAgentWipExecutionV1 in orchestration patch", () => {
    const plan = buildImplementationTaskPlan({
      projectId: "p1",
      projectArtifacts: [],
      featureDraftTitles: ["upload"],
      envOk: true,
      designOk: true,
    });
    const workItems = buildCursorWorkItemsFromImplementationTaskPlan(plan);
    const taskId = plan.items[0]?.id ?? "";
    const wip = {
      ...buildInitialCodeAgentWipExecution({
        projectId: "p1",
        plan,
        workItems,
        selectedTaskId: taskId,
        executionMode: "stub",
        bridgeExecutionStatus: "draft_created",
      }),
      status: "developer_reviewing" as const,
      selectedTaskId: taskId,
      selectedWorkItemIds: [workItems[0]?.id ?? ""],
    };
    const patch = buildPrototypeExecutionOrchestrationPersistPatch({}, { codeAgentWipExecutionV1: wip });
    const parsed = parseRequirementsStateJson(patch);
    expect(parsed.codeAgentWipExecutionV1?.executionMode).toBe("stub");
    expect(parsed.codeAgentWipExecutionV1?.bridgeExecutionStatus).toBe("draft_created");
    expect(parsed.codeAgentWipExecutionV1?.selectedTaskId).toBe(taskId);
  });
});

