import { describe, expect, it } from "vitest";
import {
  appendImplementationStageActionRunToLog,
  buildImplementationStageActionRunLogPatch,
  canRouteImplementationIntentThroughStageOrchestrator,
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

describe("appendImplementationStageActionRunToLog", () => {
  it("adds latest run to front and dedupes by runId", () => {
    const r1 = createImplementationStageActionRun({
      projectId: "p1",
      actionId: "SHOW_ARTIFACTS",
      source: "cta",
      nowIso: NOW,
    });
    const r2 = createImplementationStageActionRun({
      projectId: "p1",
      actionId: "OPEN_ENV_SETTINGS",
      source: "cta",
      nowIso: NOW,
    });
    const log1 = appendImplementationStageActionRunToLog({ currentLog: null, run: r1, nowIso: NOW });
    const log2 = appendImplementationStageActionRunToLog({ currentLog: log1, run: r2, nowIso: NOW });
    expect(log2.runs[0]).toBe(r2);
    expect(log2.runs[1]).toBe(r1);
    const log3 = appendImplementationStageActionRunToLog({ currentLog: log2, run: r1, nowIso: NOW });
    expect(log3.runs[0]).toBe(r1);
    expect(log3.runs.filter((r) => r.runId === r1.runId)).toHaveLength(1);
  });

  it("enforces maxRuns", () => {
    const runs = Array.from({ length: 3 }).map((_, i) =>
      createImplementationStageActionRun({
        projectId: "p1",
        actionId: "SHOW_ARTIFACTS",
        source: "cta",
        nowIso: `${NOW}-${i}`,
      }),
    );
    let log: any = null;
    for (const r of runs) {
      log = appendImplementationStageActionRunToLog({ currentLog: log, run: r, maxRuns: 2, nowIso: NOW });
    }
    expect(log.runs).toHaveLength(2);
  });
});

describe("buildImplementationStageActionRunLogPatch", () => {
  it("returns expected patch field", () => {
    const run = createImplementationStageActionRun({
      projectId: "p1",
      actionId: "SHOW_ARTIFACTS",
      source: "cta",
      nowIso: NOW,
    });
    const patch = buildImplementationStageActionRunLogPatch({ currentLog: null, run, nowIso: NOW });
    expect(patch.implementationStageActionRunLogV1.version).toBe("implementation_stage_action_run_log_v1");
    expect(patch.implementationStageActionRunLogV1.runs[0]?.runId).toBe(run.runId);
  });
});

describe("canRouteImplementationIntentThroughStageOrchestrator", () => {
  it("returns true only for stage-action-compatible router actions", () => {
    expect(canRouteImplementationIntentThroughStageOrchestrator("CREATE_WORK_PLAN")).toBe(true);
    expect(canRouteImplementationIntentThroughStageOrchestrator("SHOW_SCM_CHECK")).toBe(true);
    expect(canRouteImplementationIntentThroughStageOrchestrator("ADD_IMPLEMENTATION_REQUIREMENT")).toBe(false);
    expect(canRouteImplementationIntentThroughStageOrchestrator("DIRECT_IMPLEMENTATION_SCOPE_INPUT")).toBe(false);
  });
});
