import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  isRuntimeTimelineEventForExecRun,
  isRuntimeTimelineIncludeLegacyTaskEventsEnabled,
  listRuntimeTimelineForExecRun,
} from "@/lib/runtime/runtimeObservability";
import { clearRuntimeTimelineStore } from "@/lib/runtime/runtimeTimelineStore";

describe("runtimeObservability", () => {
  beforeEach(() => {
    delete process.env.RUNTIME_TIMELINE_INCLUDE_LEGACY_TASK_EVENTS;
    clearRuntimeTimelineStore();
    findRunMock.mockReset();
    findManyMock.mockReset();
    findUniqueRunMock.mockReset();
    findRunMock.mockResolvedValue({
      taskId: "task-1",
      projectId: "proj-1",
      createdAt: new Date(),
    });
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
    findManyMock.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.RUNTIME_TIMELINE_INCLUDE_LEGACY_TASK_EVENTS;
  });

  it("isRuntimeTimelineEventForExecRun requires execRunId match", () => {
    expect(
      isRuntimeTimelineEventForExecRun(
        { execRunId: "run-1", runtimeTimeline: true, eventType: "CURSOR_STARTED" },
        "run-1",
      ),
    ).toBe(true);
    expect(
      isRuntimeTimelineEventForExecRun({ execRunId: "run-2", runtimeTimeline: true }, "run-1"),
    ).toBe(false);
    expect(isRuntimeTimelineEventForExecRun({ execRunId: "run-1" }, "run-1")).toBe(false);
    expect(isRuntimeTimelineEventForExecRun({ eventType: "CURSOR_STARTED" }, "run-1")).toBe(false);
  });

  it("legacy flag defaults off", () => {
    expect(isRuntimeTimelineIncludeLegacyTaskEventsEnabled()).toBe(false);
  });

  it("excludes legacy task events without runtimeTimeline by default", async () => {
    findManyMock.mockResolvedValue([
      {
        createdAt: new Date(),
        message: "LEGACY",
        stage: "EXECUTE",
        status: "SUCCESS",
        executionJobId: "job-1",
        detailJson: { execRunId: "run-other" },
      },
      {
        createdAt: new Date(),
        message: "CURSOR_STARTED",
        stage: "EXECUTE",
        status: "SUCCESS",
        executionJobId: "job-2",
        detailJson: { execRunId: "run-1", runtimeTimeline: true, eventType: "CURSOR_STARTED" },
      },
    ]);

    const rows = await listRuntimeTimelineForExecRun("run-1");
    expect(rows.some((r) => r.eventType === "CURSOR_STARTED")).toBe(true);
    expect(rows.some((r) => r.message === "LEGACY")).toBe(false);
  });

  it("includes legacy events when RUNTIME_TIMELINE_INCLUDE_LEGACY_TASK_EVENTS=1", async () => {
    process.env.RUNTIME_TIMELINE_INCLUDE_LEGACY_TASK_EVENTS = "1";
    expect(isRuntimeTimelineIncludeLegacyTaskEventsEnabled()).toBe(true);

    findManyMock.mockResolvedValue([
      {
        createdAt: new Date(),
        message: "OLD",
        stage: "EXECUTE",
        status: "SUCCESS",
        executionJobId: "job-1",
        detailJson: { execRunId: "run-1" },
      },
    ]);

    const rows = await listRuntimeTimelineForExecRun("run-1");
    expect(rows.some((r) => r.message === "OLD")).toBe(true);
  });

  it("buildRuntimeDashboardSnapshot uses timeline event for phase", async () => {
    await appendRuntimeEvent({
      eventType: "SECURITY_STARTED",
      projectId: "proj-1",
      taskId: "task-1",
      execRunId: "run-1",
      workerName: "pipeline",
    });

    const snap = await buildRuntimeDashboardSnapshot("run-1");
    expect(snap?.currentPhase).toBe("SECURITY");
    expect(snap?.timelineCount).toBeGreaterThan(0);
  });
});
