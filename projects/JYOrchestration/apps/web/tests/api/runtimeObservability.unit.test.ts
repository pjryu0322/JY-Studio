import { beforeEach, describe, expect, it, vi } from "vitest";

const findRunMock = vi.fn();
const findManyMock = vi.fn();
const findUniqueRunMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    taskExecutionRun: {
      findUnique: (...args: unknown[]) => {
        const sel = (args[0] as { select?: { taskId?: boolean } })?.select;
        if (sel?.taskId) return findRunMock(...args);
        return findUniqueRunMock(...args);
      },
    },
    executionEventLog: {
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
  },
}));

vi.mock("@/lib/ai-team-runtime/persist", () => ({
  readTeamExecutionStatus: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/runtime/runtimeEventPersistence", () => ({
  persistRuntimeEventToExecutionLog: vi.fn().mockResolvedValue(undefined),
  getOrCreateRuntimeTimelineHolderJobId: vi.fn().mockResolvedValue("holder-job-1"),
}));

import { appendRuntimeEvent } from "@/lib/runtime/runtimeEventService";
import {
  buildRuntimeDashboardSnapshot,
  inferPhaseAndWorkerFromEventType,
  listRuntimeTimelineForExecRun,
} from "@/lib/runtime/runtimeObservability";
import { clearRuntimeTimelineStore } from "@/lib/runtime/runtimeTimelineStore";

describe("runtimeObservability", () => {
  beforeEach(() => {
    clearRuntimeTimelineStore();
    findRunMock.mockReset();
    findManyMock.mockReset();
    findUniqueRunMock.mockReset();
    findRunMock.mockResolvedValue({
      taskId: "task-1",
      projectId: "proj-1",
      createdAt: new Date(),
    });
    findManyMock.mockResolvedValue([]);
    findUniqueRunMock.mockResolvedValue({
      id: "run-1",
      taskId: "task-1",
      projectId: "proj-1",
      status: "running",
      retryCount: 0,
      evaluationDecision: null,
      evaluationReason: null,
      prStatus: null,
      pushStatus: null,
      runError: null,
      teamExecutionStatus: null,
    });
  });

  it("inferPhaseAndWorkerFromEventType maps worker events", () => {
    expect(inferPhaseAndWorkerFromEventType("CURSOR_STARTED")).toEqual({
      phase: "CURSOR",
      worker: "cursor",
    });
    expect(inferPhaseAndWorkerFromEventType("REVIEW_STARTED").worker).toBe("pipeline:reviewer");
    expect(inferPhaseAndWorkerFromEventType("SELF_HEALING_CURSOR_ENQUEUED").phase).toBe(
      "SELF_HEALING"
    );
  });

  it("records timeline via appendRuntimeEvent without executionJobId", async () => {
    await appendRuntimeEvent({
      eventType: "CURSOR_STARTED",
      projectId: "proj-1",
      taskId: "task-1",
      execRunId: "run-1",
      workerName: "cursor",
    });

    const merged = await listRuntimeTimelineForExecRun("run-1");
    expect(merged.some((r) => r.eventType === "CURSOR_STARTED")).toBe(true);
  });

  it("buildRuntimeDashboardSnapshot uses last timeline event for phase", async () => {
    await appendRuntimeEvent({
      eventType: "SECURITY_STARTED",
      projectId: "proj-1",
      taskId: "task-1",
      execRunId: "run-1",
      workerName: "pipeline",
    });

    const snap = await buildRuntimeDashboardSnapshot("run-1");
    expect(snap?.currentPhase).toBe("SECURITY");
    expect(snap?.currentWorker).toBe("pipeline:security");
    expect(snap?.timelineCount).toBeGreaterThan(0);
    expect(snap?.lastEventAt).toBeTruthy();
  });
});
