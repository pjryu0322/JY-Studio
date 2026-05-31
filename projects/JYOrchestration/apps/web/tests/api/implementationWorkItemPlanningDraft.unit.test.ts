import { describe, expect, it } from "vitest";
import { buildGenerateImplementationTaskListFromSeedResult } from "@/lib/prototype/implementationTaskListGeneration";
import type { ImplementationSeedV1 } from "@/lib/requirements/implementationSeed";

const NOW = "2026-05-28T00:00:00.000Z";

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

describe("planning stage work item drafts", () => {
  it("creates cursorWorkItemsV1 with planning origin when task list is generated", () => {
    const result = buildGenerateImplementationTaskListFromSeedResult({
      projectId: "p1",
      seed: confirmedSeed(),
      envOk: true,
      designOk: true,
      nowIso: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.cursorWorkItemsV1?.length).toBeGreaterThan(0);
    expect(result.patch.cursorWorkItemsV1?.every((item) => item.originStage === "planning")).toBe(true);
    expect(result.patch.cursorWorkItemsV1?.every((item) => item.refinementStatus === "draft")).toBe(true);
    expect(result.patch.cursorWorkItemsV1?.every((item) => item.codeTaskId)).toBe(true);
    expect(
      result.patch.promptTimeline?.some((entry) => entry.action === "implementation_code_task_plan_created"),
    ).toBe(true);
    expect(
      result.patch.promptTimeline?.some((entry) => entry.action === "implementation_ready_for_execution"),
    ).toBe(true);
  });
});
