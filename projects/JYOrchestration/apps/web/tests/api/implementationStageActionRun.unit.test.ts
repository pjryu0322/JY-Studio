import { describe, expect, it } from "vitest";
import {
  completeImplementationStageActionRun,
  createImplementationStageActionRun,
  mapImplementationRouterActionToStageAction,
  statusFromImplementationStageActionRunResult,
} from "@/lib/prototype/implementationStageActionRun";

const NOW = "2026-05-28T00:00:00.000Z";

describe("createImplementationStageActionRun", () => {
  it("creates run with routed status and identifiers", () => {
    const run = createImplementationStageActionRun({
      projectId: "p1",
      actionId: "CONFIRM_IMPLEMENTATION_WORK_PLAN",
      source: "cta",
      nowIso: NOW,
    });
    expect(run.runId).toMatch(/^impl-run-/);
    expect(run.projectId).toBe("p1");
    expect(run.actionId).toBe("CONFIRM_IMPLEMENTATION_WORK_PLAN");
    expect(run.source).toBe("cta");
    expect(run.status).toBe("routed");
    expect(run.startedAt).toBe(NOW);
    expect(run.timelineEntries).toEqual([]);
  });
});

describe("statusFromImplementationStageActionRunResult", () => {
  it("maps run outcomes to run status", () => {
    expect(statusFromImplementationStageActionRunResult({ outcome: "executed" })).toBe("succeeded");
    expect(statusFromImplementationStageActionRunResult({ outcome: "blocked", message: "x" })).toBe(
      "blocked",
    );
    expect(statusFromImplementationStageActionRunResult({ outcome: "no_op", message: "x" })).toBe("no_op");
  });
});

describe("completeImplementationStageActionRun", () => {
  it("reflects completedAt, runResult, and timeline entries", () => {
    const run = createImplementationStageActionRun({
      projectId: "p1",
      actionId: "SHOW_ARTIFACTS",
      source: "cta",
      nowIso: NOW,
    });
    const timelineEntries = [
      {
        stage: "implementation",
        action: "implementation_stage_action_routed",
        responseText: "routed",
        createdAt: NOW,
      },
    ] as const;
    const completed = completeImplementationStageActionRun({
      run,
      gateResult: { ok: true },
      runResult: { outcome: "executed" },
      timelineEntries,
      completedAt: "2026-05-28T00:00:01.000Z",
    });
    expect(completed.status).toBe("succeeded");
    expect(completed.completedAt).toBe("2026-05-28T00:00:01.000Z");
    expect(completed.runResult).toEqual({ outcome: "executed" });
    expect(completed.timelineEntries).toBe(timelineEntries);
  });

  it("sets blocked status from gate failure", () => {
    const run = createImplementationStageActionRun({
      projectId: "p1",
      actionId: "GENERATE_IMPLEMENTATION_WORK_PLAN",
      source: "cta",
      nowIso: NOW,
    });
    const completed = completeImplementationStageActionRun({
      run,
      gateResult: { ok: false, message: "seed not confirmed" },
      runResult: { outcome: "blocked", message: "seed not confirmed" },
      completedAt: NOW,
    });
    expect(completed.status).toBe("blocked");
    expect(completed.message).toBe("seed not confirmed");
  });
});

describe("mapImplementationRouterActionToStageAction", () => {
  it("maps router actions to stage actions", () => {
    expect(mapImplementationRouterActionToStageAction("CREATE_WORK_PLAN")).toBe(
      "GENERATE_IMPLEMENTATION_WORK_PLAN",
    );
    expect(mapImplementationRouterActionToStageAction("SHOW_SCM_CHECK")).toBe("SHOW_SCM_CHECK");
    expect(mapImplementationRouterActionToStageAction("NO_ACTION")).toBeNull();
    expect(mapImplementationRouterActionToStageAction(null)).toBeNull();
  });
});
