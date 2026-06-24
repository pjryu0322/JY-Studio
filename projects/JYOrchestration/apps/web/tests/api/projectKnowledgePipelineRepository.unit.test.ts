import { describe, expect, it, vi, beforeEach } from "vitest";

const createMock = vi.fn();
const appendStepMock = vi.fn();
const stepFindUniqueMock = vi.fn();
const stepUpdateMock = vi.fn();
const completeMock = vi.fn();
const failMock = vi.fn();
const findLatestMock = vi.fn();
const findManyMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectKnowledgePipelineRun: {
      create: (...args: unknown[]) => createMock(...args),
      update: (...args: unknown[]) => completeMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      findFirst: (...args: unknown[]) => findLatestMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
    },
    projectKnowledgePipelineStep: {
      create: (...args: unknown[]) => appendStepMock(...args),
      findUnique: (...args: unknown[]) => stepFindUniqueMock(...args),
      update: (...args: unknown[]) => stepUpdateMock(...args),
    },
  },
}));

import {
  appendPipelineStep,
  completePipelineRun,
  completePipelineStep,
  createPipelineRun,
  createPipelineStep,
  failPipelineRun,
  failPipelineStep,
  findLatestPipelineRun,
  findPipelineRuns,
  mapPipelineRunRow,
} from "@/lib/project-knowledge/projectKnowledgePipelineRepository";

describe("projectKnowledgePipelineRepository", () => {
  beforeEach(() => {
    createMock.mockReset();
    appendStepMock.mockReset();
    stepFindUniqueMock.mockReset();
    stepUpdateMock.mockReset();
    completeMock.mockReset();
    failMock.mockReset();
    findLatestMock.mockReset();
    findManyMock.mockReset();
    findUniqueMock.mockReset();
    const started = new Date("2026-06-24T04:00:00.000Z");
    stepFindUniqueMock.mockResolvedValue({ id: "step-1", startedAt: started, summary: null });
    stepUpdateMock.mockResolvedValue({ id: "step-1", status: "SUCCESS" });
  });

  it("createPipelineRun sets persistenceMode DATABASE", async () => {
    const started = new Date("2026-06-24T04:00:00.000Z");
    createMock.mockResolvedValue({
      id: "run-1",
      projectId: "p1",
      triggerType: "requirements_saved",
      status: "RUNNING",
      persistenceMode: "DATABASE",
      startedAt: started,
      completedAt: null,
      durationMs: null,
      eventCount: null,
      candidateCount: null,
      nodeCount: null,
      edgeCount: null,
      candidateNodeCount: null,
      candidateEdgeCount: null,
      graphNodeCount: null,
      graphEdgeCount: null,
      errorMessage: null,
    });
    const row = await createPipelineRun("p1", "requirements_saved");
    expect(row.id).toBe("run-1");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ persistenceMode: "DATABASE" }),
      }),
    );
  });

  it("appendPipelineStep creates step row and completes", async () => {
    appendStepMock.mockResolvedValue({ id: "step-1" });
    await appendPipelineStep("run-1", { stage: "EVENT_SYNC", title: "Conversation Saved", ok: true });
    expect(appendStepMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ runId: "run-1", stage: "EVENT_SYNC", status: "RUNNING" }),
      }),
    );
    expect(stepUpdateMock).toHaveBeenCalled();
  });

  it("createPipelineStep creates RUNNING step", async () => {
    appendStepMock.mockResolvedValue({ id: "step-2" });
    await createPipelineStep("run-1", { stage: "GRAPH_PROJECTION", title: "Graph Synced" });
    expect(appendStepMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RUNNING", completedAt: null }),
      }),
    );
  });

  it("completePipelineStep marks SUCCESS", async () => {
    await completePipelineStep("step-1", { summary: "done", durationMs: 12 });
    expect(stepUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUCCESS", summary: "done" }),
      }),
    );
  });

  it("failPipelineStep marks FAILED", async () => {
    await failPipelineStep("step-1", { summary: "err" });
    expect(stepUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED", summary: "err" }),
      }),
    );
  });

  it("mapPipelineRunRow maps steps in order", () => {
    const started = new Date("2026-06-24T04:00:00.000Z");
    const mapped = mapPipelineRunRow(
      {
        id: "run-1",
        projectId: "p1",
        triggerType: "requirements_saved",
        status: "COMPLETED",
        persistenceMode: "DATABASE",
        startedAt: started,
        completedAt: started,
        durationMs: 100,
        eventCount: 2,
        candidateCount: 5,
        nodeCount: 8,
        edgeCount: 3,
        candidateNodeCount: 5,
        candidateEdgeCount: 3,
        graphNodeCount: 8,
        graphEdgeCount: 3,
        errorMessage: null,
        createdAt: started,
        updatedAt: started,
      },
      [
        {
          id: "s1",
          runId: "run-1",
          stage: "EVENT_SYNC",
          status: "SUCCESS",
          title: "Conversation Saved",
          summary: null,
          sourceEventId: null,
          sourceMessageId: null,
          metadata: null,
          startedAt: started,
          completedAt: started,
          durationMs: 42,
          createdAt: started,
          updatedAt: started,
        },
      ],
    );
    expect(mapped.steps).toHaveLength(1);
    expect(mapped.status).toBe("COMPLETED");
    expect(mapped.candidateCount).toBe(5);
    expect(mapped.graphNodeCount).toBe(8);
    expect(mapped.persistenceMode).toBe("DATABASE");
  });

  it("findLatestPipelineRun returns mapped run", async () => {
    const started = new Date("2026-06-24T04:00:00.000Z");
    findLatestMock.mockResolvedValue({
      id: "run-1",
      projectId: "p1",
      triggerType: "requirements_saved",
      status: "COMPLETED",
      persistenceMode: "DATABASE",
      startedAt: started,
      completedAt: started,
      durationMs: 10,
      eventCount: null,
      candidateCount: null,
      nodeCount: null,
      edgeCount: null,
      errorMessage: null,
      createdAt: started,
      updatedAt: started,
      steps: [],
    });
    const latest = await findLatestPipelineRun("p1");
    expect(latest?.id).toBe("run-1");
  });

  it("findPipelineRuns respects limit via findMany", async () => {
    findManyMock.mockResolvedValue([]);
    await findPipelineRuns("p1", 20);
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
  });

  it("completePipelineRun updates status", async () => {
    findUniqueMock.mockResolvedValue({
      id: "run-1",
      startedAt: new Date("2026-06-24T04:00:00.000Z"),
    });
    completeMock.mockResolvedValue({ id: "run-1", status: "COMPLETED" });
    await completePipelineRun("run-1", { metrics: { eventCount: 1 } });
    expect(completeMock).toHaveBeenCalled();
  });

  it("failPipelineRun updates failed status", async () => {
    findUniqueMock.mockResolvedValue({
      id: "run-1",
      startedAt: new Date("2026-06-24T04:00:00.000Z"),
    });
    completeMock.mockResolvedValue({ id: "run-1", status: "FAILED" });
    await failPipelineRun("run-1", { errorMessage: "boom" });
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-1" },
        data: expect.objectContaining({ status: "FAILED", errorMessage: "boom" }),
      }),
    );
  });
});
