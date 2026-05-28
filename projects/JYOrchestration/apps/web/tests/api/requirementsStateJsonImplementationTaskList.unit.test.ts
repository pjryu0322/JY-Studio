import { describe, expect, it } from "vitest";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
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

describe("requirementsStateJson parses implementationTaskListV1", () => {
  it("parses and preserves implementationTaskListV1", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: makeSeed(),
      nowIso: NOW,
    });
    const state = parseRequirementsStateJson({
      implementationSeedV1: makeSeed(),
      implementationTaskListV1: taskList,
    });
    expect(state.implementationTaskListV1?.version).toBe("implementation_task_list_v1");
    expect(state.implementationTaskListV1?.tasks.length).toBeGreaterThan(0);
  });
});

