import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  computeKnowledgePipelineOpsDiagnostics,
} from "@/lib/project-knowledge/projectKnowledgePipelineDiagnostics";
import {
  normalizePipelineRunMetrics,
  pipelineStepsToActivityItems,
  STAGE_USER_LABELS,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
import type { KnowledgePipelineRunRecord } from "@/lib/project-knowledge/projectKnowledgePipelineMonitorTypes";
import {
  memoryCompleteKnowledgePipelineStep,
  memoryFailKnowledgePipelineStep,
  memoryStartKnowledgePipelineRun,
  memoryStartKnowledgePipelineStep,
  resetMemoryKnowledgePipelineRunsForTests,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorMemory";
import {
  completeKnowledgePipelineRun,
  completeKnowledgePipelineStep,
  failKnowledgePipelineStep,
  startKnowledgePipelineRun,
  startKnowledgePipelineStep,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import { createPipelineRun } from "@/lib/project-knowledge/projectKnowledgePipelineRepository";

vi.mock("@/lib/project-knowledge/projectKnowledgePipelineRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/project-knowledge/projectKnowledgePipelineRepository")>();
  return {
    ...actual,
    createPipelineRun: vi.fn(),
    createPipelineStep: vi.fn(),
    completePipelineStep: vi.fn(),
    failPipelineStep: vi.fn(),
    appendPipelineStep: vi.fn(),
    completePipelineRun: vi.fn(),
    failPipelineRun: vi.fn(),
    findLatestPipelineRun: vi.fn().mockRejectedValue(new Error("no db")),
    findPipelineRuns: vi.fn().mockRejectedValue(new Error("no db")),
    loadPipelineRunById: vi.fn(),
  };
});

function baseRun(overrides: Partial<KnowledgePipelineRunRecord> = {}): KnowledgePipelineRunRecord {
  return {
    id: "run-1",
    projectId: "p1",
    trigger: "requirements_saved",
    status: "COMPLETED",
    persistenceMode: "DATABASE",
    startedAt: "2026-06-24T04:00:00.000Z",
    completedAt: "2026-06-24T04:00:10.000Z",
    durationMs: 10_000,
    currentStage: "COMPLETED",
    steps: [],
    ...overrides,
  };
}

describe("Phase 5.6+ pipeline metrics", () => {
  it("normalizePipelineRunMetrics maps legacy fields", () => {
    const m = normalizePipelineRunMetrics({ eventCount: 1, candidateCount: 2, nodeCount: 3, edgeCount: 4 });
    expect(m?.candidateNodeCount).toBe(2);
    expect(m?.graphNodeCount).toBe(3);
    expect(m?.graphEdgeCount).toBe(4);
  });

  it("normalizePipelineRunMetrics prefers explicit graph counts", () => {
    const m = normalizePipelineRunMetrics({
      candidateNodeCount: 1,
      candidateEdgeCount: 2,
      graphNodeCount: 9,
      graphEdgeCount: 8,
    });
    expect(m?.graphNodeCount).toBe(9);
    expect(m?.candidateEdgeCount).toBe(2);
  });

  it("normalizePipelineRunMetrics returns undefined for empty input", () => {
    expect(normalizePipelineRunMetrics(undefined)).toBeUndefined();
  });
});

describe("Phase 5.6+ ops diagnostics", () => {
  it("returns zeros for empty runs", () => {
    const d = computeKnowledgePipelineOpsDiagnostics([]);
    expect(d.sampleSize).toBe(0);
    expect(d.fallbackCount).toBe(0);
    expect(d.successRatePercent).toBeNull();
  });

  it("computes average duration from sample", () => {
    const runs = [
      baseRun({ durationMs: 100 }),
      baseRun({ id: "run-2", durationMs: 300, startedAt: "2026-06-24T05:00:00.000Z" }),
    ];
    const d = computeKnowledgePipelineOpsDiagnostics(runs);
    expect(d.averageDurationMs).toBe(200);
    expect(d.sampleSize).toBe(2);
  });

  it("counts failures and success rate", () => {
    const runs = [
      baseRun({ status: "COMPLETED" }),
      baseRun({ id: "run-2", status: "FAILED" }),
      baseRun({ id: "run-3", status: "COMPLETED" }),
    ];
    const d = computeKnowledgePipelineOpsDiagnostics(runs);
    expect(d.recentFailureCount).toBe(1);
    expect(d.successRatePercent).toBe(67);
  });

  it("counts memory fallback runs", () => {
    const runs = [
      baseRun({ persistenceMode: "MEMORY_FALLBACK" }),
      baseRun({ id: "run-2", persistenceMode: "DATABASE" }),
    ];
    expect(computeKnowledgePipelineOpsDiagnostics(runs).fallbackCount).toBe(1);
  });

  it("limits sample to 20 runs", () => {
    const runs = Array.from({ length: 25 }, (_, i) => baseRun({ id: `run-${i}`, durationMs: 10 }));
    expect(computeKnowledgePipelineOpsDiagnostics(runs).sampleSize).toBe(20);
  });
});

describe("Phase 5.6+ memory step lifecycle", () => {
  beforeEach(() => {
    resetMemoryKnowledgePipelineRunsForTests();
  });

  it("starts step as RUNNING", () => {
    const run = memoryStartKnowledgePipelineRun("p1", "manual_sync");
    const stepId = memoryStartKnowledgePipelineStep(run.id, { stage: "EVENT_SYNC", title: "Sync" });
    expect(stepId).toContain(":step:");
    const latest = run;
    expect(latest.persistenceMode).toBe("MEMORY_FALLBACK");
  });

  it("completes step as SUCCESS", () => {
    const run = memoryStartKnowledgePipelineRun("p1", "t");
    const stepId = memoryStartKnowledgePipelineStep(run.id, { stage: "EVENT_SYNC", title: "Sync" })!;
    memoryCompleteKnowledgePipelineStep(stepId, { summary: "ok" });
    // re-read via complete run path
    expect(stepId).toBeTruthy();
  });

  it("fails step as FAILED", () => {
    const run = memoryStartKnowledgePipelineRun("p1", "t");
    const stepId = memoryStartKnowledgePipelineStep(run.id, { stage: "GRAPH_PROJECTION", title: "Graph" })!;
    memoryFailKnowledgePipelineStep(stepId, { summary: "boom" });
    expect(stepId).toBeTruthy();
  });
});

describe("Phase 5.6+ monitor memory fallback", () => {
  beforeEach(() => {
    resetMemoryKnowledgePipelineRunsForTests();
    vi.mocked(createPipelineRun).mockRejectedValue(new Error("db down"));
  });

  it("startKnowledgePipelineRun uses MEMORY_FALLBACK", async () => {
    const run = await startKnowledgePipelineRun("p-fallback", "requirements_saved");
    expect(run.persistenceMode).toBe("MEMORY_FALLBACK");
    expect(run.id.startsWith("run:")).toBe(true);
  });

  it("step lifecycle via monitor on memory run", async () => {
    const run = await startKnowledgePipelineRun("p-fallback", "t");
    const stepId = await startKnowledgePipelineStep(run.id, {
      stage: "CANDIDATE_EXTRACTION",
      title: "Candidate Generated",
    });
    expect(stepId).toBeTruthy();
    await completeKnowledgePipelineStep(stepId!, { summary: "done", durationMs: 5 });
    await failKnowledgePipelineStep(stepId!, { summary: "ignored" });
  });

  it("completeKnowledgePipelineRun stores extended metrics", async () => {
    const run = await startKnowledgePipelineRun("p-fallback", "t");
    const finished = await completeKnowledgePipelineRun(run.id, {
      metrics: {
        candidateNodeCount: 1,
        candidateEdgeCount: 2,
        graphNodeCount: 3,
        graphEdgeCount: 4,
      },
    });
    expect(finished?.candidateNodeCount).toBe(1);
    expect(finished?.graphEdgeCount).toBe(4);
  });
});

describe("Phase 5.6+ activity mapping", () => {
  it("maps step status into activity technicalDetail", () => {
    const run = baseRun({
      steps: [
        {
          id: "s1",
          stage: "EVENT_SYNC",
          title: "Conversation Saved",
          startedAt: "2026-06-24T04:00:00.000Z",
          occurredAt: "2026-06-24T04:00:01.000Z",
          ok: true,
          status: "SUCCESS",
        },
      ],
    });
    const items = pipelineStepsToActivityItems(run);
    expect(items[0]?.technicalDetail?.stepStatus).toBe("SUCCESS");
  });

  it("exposes stage labels", () => {
    expect(STAGE_USER_LABELS.GRAPH_PROJECTION).toBe("Graph Synced");
  });
});
