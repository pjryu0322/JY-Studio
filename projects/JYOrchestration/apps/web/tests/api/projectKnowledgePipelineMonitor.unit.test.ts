import { describe, expect, it, beforeEach } from "vitest";
import {
  completeKnowledgePipelineRun,
  startKnowledgePipelineRun,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import {
  memoryGetLatestKnowledgePipelineRun,
  resetMemoryKnowledgePipelineRunsForTests,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitorMemory";
import { buildKnowledgeActivityItems } from "@/lib/project-knowledge/projectKnowledgeActivityBuilder";

describe("projectKnowledgePipelineMonitor", () => {
  beforeEach(() => {
    resetMemoryKnowledgePipelineRunsForTests();
  });

  it("records pipeline timeline steps via memory fallback path", async () => {
    const run = await startKnowledgePipelineRun("p-monitor-fallback", "requirements_saved");
    await completeKnowledgePipelineRun(run.id, { metrics: { eventCount: 1 } });
    const latest = memoryGetLatestKnowledgePipelineRun("p-monitor-fallback");
    expect(latest?.steps.length).toBeGreaterThanOrEqual(1);
    const items = buildKnowledgeActivityItems({ pipelineRun: latest });
    expect(items.length).toBeGreaterThan(0);
  });
});
