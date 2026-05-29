import { describe, expect, it } from "vitest";
import { deriveImplementationTaskListReadiness } from "@/lib/prototype/implementationTaskListReadiness";
import { buildImplementationTaskListFromSeed } from "@/lib/requirements/implementationTaskList";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

const NOW = "2026-05-29T12:00:00.000Z";

function confirmedSeed(): ImplementationSeedV1 {
  return {
    version: "implementation_seed_v1",
    projectId: "p1",
    createdAt: NOW,
    updatedAt: NOW,
    lifecycleStatus: "confirmed",
    readiness: { ready: true, score: 1, missing: [], warnings: [] },
    processImplementationItems: [
      { id: "p1", processName: "주문", actors: ["user"], screens: ["s1"], summary: "s" },
    ],
    screenImplementationItems: [
      {
        id: "s1",
        screenName: "목록",
        routeOrEntry: "/list",
        primaryActions: ["조회"],
        dataEntities: [],
        linkedProcesses: [],
      },
    ],
    actorCapabilityMatrix: [],
    commonDetailFeatures: [],
    dataModelSeed: { entities: ["Order"], fieldsByEntity: {}, relationships: [], mockDataNotes: [] },
    assumptions: [],
    gaps: [],
  };
}

describe("deriveImplementationTaskListReadiness", () => {
  it("confirmed seed + no taskList → ready_to_generate_from_seed", () => {
    const r = deriveImplementationTaskListReadiness({
      implementationSeedV1: confirmedSeed(),
      implementationTaskListV1: null,
    });
    expect(r.status).toBe("ready_to_generate_from_seed");
    expect(r.canGenerateTaskList).toBe(true);
  });

  it("no seed + no taskList → missing_seed", () => {
    const r = deriveImplementationTaskListReadiness({
      implementationSeedV1: null,
      implementationTaskListV1: null,
    });
    expect(r.status).toBe("missing_seed");
    expect(r.canGenerateTaskList).toBe(false);
  });

  it("taskList exists → task_list_exists", () => {
    const taskList = buildImplementationTaskListFromSeed({
      projectId: "p1",
      seed: confirmedSeed(),
      nowIso: NOW,
    });
    const r = deriveImplementationTaskListReadiness({
      implementationSeedV1: confirmedSeed(),
      implementationTaskListV1: taskList,
    });
    expect(r.status).toBe("task_list_exists");
    expect(r.canGenerateTaskList).toBe(false);
  });

  it("unconfirmed seed → seed_not_confirmed", () => {
    const seed = { ...confirmedSeed(), lifecycleStatus: "candidate" as const, readiness: { ready: false, score: 0, missing: ["x"], warnings: [] } };
    const r = deriveImplementationTaskListReadiness({
      implementationSeedV1: seed,
      implementationTaskListV1: null,
    });
    expect(r.status).toBe("seed_not_confirmed");
  });
});
