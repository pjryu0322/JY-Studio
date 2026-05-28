import { describe, expect, it } from "vitest";
import { buildPrototypeExecutionOrchestrationPersistPatch } from "@/lib/prototype/prototypeExecutionTaskPlanPersist";
import type { ImplementationStageActionRun } from "@/lib/prototype/implementationStageActionRun";

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
});

