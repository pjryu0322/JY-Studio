import { describe, expect, it, vi, beforeEach } from "vitest";

const createMock = vi.fn();
const appendStepMock = vi.fn();
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
    },
  },
}));

import {
  appendPipelineStep,
  completePipelineRun,
  createPipelineRun,
  failPipelineRun,
  findLatestPipelineRun,
  findPipelineRuns,
  mapPipelineRunRow,
} from "@/lib/project-knowledge/projectKnowledgePipelineRepository";

describe("projectKnowledgePipelineRepository", () => {
  beforeEach(() => {
    createMock.mockReset();
    appendStepMock.mockReset();
    completeMock.mockReset();
    failMock.mockReset();
    findLatestMock.mockReset();
    findManyMock.mockReset();
    findUniqueMock.mockReset();
  });

  it("createPipelineRun delegates to prisma", async () => {
    const started = new Date("2026-06-24T04:00:00.000Z");
    createMock.mockResolvedValue({
      id: "run-1",
      projectId: "p1",
      triggerType: "requirements_saved",
      status: "RUNNING",
      startedAt: started,
      completedAt: null,
      durationMs: null,
      eventCount: null,
      candidateCount: null,
      nodeCount: null,
      edgeCount: null,
      errorMessage: null,
    });
    const row = await createPipelineRun("p1", "requirements_saved");
    expect(row.id).toBe("run-1");
    expect(createMock).toHaveBeenCalled();
  });

  it("appendPipelineStep creates step row", async () => {
    appendStepMock.mockResolvedValue({ id: "step-1" });
    await appendPipelineStep("run-1", { stage: "EVENT_SYNC", title: "Conversation Saved", ok: true });
    expect(appendStepMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ runId: "run-1", stage: "EVENT_SYNC" }),
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
        startedAt: started,
        completedAt: started,
        durationMs: 100,
        eventCount: 2,
        candidateCount: 5,
        nodeCount: 5,
        edgeCount: 3,
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
  });

  it("findLatestPipelineRun returns mapped run", async () => {
    const started = new Date("2026-06-24T04:00:00.000Z");
    findLatestMock.mockResolvedValue({
      id: "run-1",
      projectId: "p1",
      triggerType: "requirements_saved",
      status: "COMPLETED",
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
