import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@/lib/project-knowledge/projectKnowledgePipelineRepository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/project-knowledge/projectKnowledgePipelineRepository")>();
  return {
    ...actual,
    createPipelineRun: vi.fn().mockRejectedValue(new Error("no db")),
    findLatestPipelineRun: vi.fn().mockRejectedValue(new Error("no db")),
    findPipelineRuns: vi.fn().mockRejectedValue(new Error("no db")),
  };
});

import { createPipelineRun } from "@/lib/project-knowledge/projectKnowledgePipelineRepository";
import {
  completeKnowledgePipelineRun,
  startKnowledgePipelineRun,
  startKnowledgePipelineStep,
  completeKnowledgePipelineStep,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import {
  memoryGetLatestKnowledgePipelineRun,
  resetMemoryKnowledgePipelineRunsForTests,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorMemory";
import { buildKnowledgeActivityItems } from "@/lib/project-knowledge/projectKnowledgeActivityBuilder";

describe("projectKnowledgePipelineMonitor", () => {
  beforeEach(() => {
    resetMemoryKnowledgePipelineRunsForTests();
    vi.mocked(createPipelineRun).mockRejectedValue(new Error("no db"));
  });

  it("records pipeline timeline steps via memory fallback path", async () => {
    const run = await startKnowledgePipelineRun("p-monitor-fallback", "requirements_saved");
    await completeKnowledgePipelineRun(run.id, { metrics: { eventCount: 1 } });
    const latest = memoryGetLatestKnowledgePipelineRun("p-monitor-fallback");
    expect(latest?.steps.length).toBeGreaterThanOrEqual(1);
    expect(latest?.persistenceMode).toBe("MEMORY_FALLBACK");
    const items = buildKnowledgeActivityItems({ pipelineRun: latest });
    expect(items.length).toBeGreaterThan(0);
  });

  it("leaves intermediate step RUNNING until completed", async () => {
    const run = await startKnowledgePipelineRun("p-step", "manual_sync");
    const stepId = await startKnowledgePipelineStep(run.id, {
      stage: "EVENT_SYNC",
      title: "Conversation Saved",
    });
    let latest = memoryGetLatestKnowledgePipelineRun("p-step");
    expect(latest?.steps.some((s) => s.id === stepId && s.status === "RUNNING")).toBe(true);
    await completeKnowledgePipelineStep(stepId!, { durationMs: 3 });
    latest = memoryGetLatestKnowledgePipelineRun("p-step");
    expect(latest?.steps.find((s) => s.id === stepId)?.status).toBe("SUCCESS");
  });
});
