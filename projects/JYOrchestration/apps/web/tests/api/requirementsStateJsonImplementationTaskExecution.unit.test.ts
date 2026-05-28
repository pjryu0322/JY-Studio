import { describe, expect, it } from "vitest";
import {
  buildInitialImplementationTaskExecutionStateFromTaskList,
  markDeveloperTasksInProgressForWip,
} from "@/lib/prototype/implementationTaskExecutionState";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

const NOW = "2026-05-28T00:00:00.000Z";

function makeSeed(): ImplementationSeedV1 {
  return {
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
}

describe("requirementsStateJson implementationTaskExecutionStateV1", () => {
  it("parseRequirementsStateJson parses implementationTaskExecutionStateV1", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    const state = parseRequirementsStateJson({
      implementationTaskListV1: taskList,
      implementationTaskExecutionStateV1: executionState,
    });
    expect(state.implementationTaskExecutionStateV1?.version).toBe(
      "implementation_task_execution_state_v1",
    );
    expect(state.implementationTaskExecutionStateV1?.summary.total).toBe(
      executionState.summary.total,
    );
    expect(state.implementationTaskExecutionStateV1?.items.length).toBeGreaterThan(0);
  });

  it("parseRequirementsStateJson skips invalid execution state rows", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    const state = parseRequirementsStateJson({
      implementationTaskExecutionStateV1: {
        ...executionState,
        items: [
          { taskId: "bad", ownerRole: "hacker", status: "ready" },
          ...executionState.items,
        ],
      },
    });
    expect(state.implementationTaskExecutionStateV1?.items).toHaveLength(
      executionState.items.length,
    );
    expect(
      state.implementationTaskExecutionStateV1?.items.some((i) => i.ownerRole === "hacker"),
    ).toBe(false);
  });

  it("mergeRequirementsStateJson preserves implementationTaskExecutionStateV1", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    const executionState = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    const parsed = parseRequirementsStateJson({
      implementationTaskListV1: taskList,
      implementationTaskExecutionStateV1: executionState,
    });
    const merged = mergeRequirementsStateJson(parsed, { lastUserDraftText: "draft" });
    expect(merged.implementationTaskExecutionStateV1?.projectId).toBe("p1");
    expect(merged.implementationTaskExecutionStateV1?.summary.total).toBe(
      executionState.summary.total,
    );
  });

  it("mergeRequirementsStateJson can update implementationTaskExecutionStateV1", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    const devTask = taskList.tasks.find((t) => t.ownerRole === "developer");
    const workItems = devTask
      ? [
          {
            id: "wi-1",
            taskId: devTask.taskId,
            title: devTask.title,
            prompt: "p",
            requiredFilesHint: [],
            expectedOutput: [],
            testCommands: [],
            forbiddenPaths: [],
            blocked: false,
            blockers: [],
            qualityGate: { score: 1, promptReady: true, missing: [] },
          },
        ]
      : [];
    const initial = buildInitialImplementationTaskExecutionStateFromTaskList({
      projectId: "p1",
      taskList,
      nowIso: NOW,
    });
    const updated = markDeveloperTasksInProgressForWip({
      state: initial,
      taskList,
      cursorWorkItems: workItems,
      projectId: "p1",
      nowIso: NOW,
    });
    const parsed = parseRequirementsStateJson({
      implementationTaskExecutionStateV1: initial,
    });
    const merged = mergeRequirementsStateJson(parsed, {
      implementationTaskExecutionStateV1: updated,
    });
    expect(merged.implementationTaskExecutionStateV1?.summary.inProgress).toBeGreaterThan(0);
    expect(merged.implementationTaskExecutionStateV1?.summary.inProgress).toBe(
      updated.summary.inProgress,
    );
  });
});
