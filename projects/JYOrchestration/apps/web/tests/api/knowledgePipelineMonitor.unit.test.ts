import { describe, expect, it } from "vitest";
import {
  appendKnowledgePipelineStep,
  completeKnowledgePipelineRun,
  getLatestKnowledgePipelineRun,
  startKnowledgePipelineRun,
} from "@/lib/project-knowledge/projectKnowledgePipelineMonitor";
import { buildKnowledgeActivityItems } from "@/lib/project-knowledge/projectKnowledgeActivityBuilder";

describe("knowledgePipelineMonitor", () => {
  it("records pipeline timeline steps", () => {
    const run = startKnowledgePipelineRun("p1", "requirements_saved");
    appendKnowledgePipelineStep(run.id, { stage: "EVENT_SYNC", title: "Conversation Saved" });
    completeKnowledgePipelineRun(run.id);
    const latest = getLatestKnowledgePipelineRun("p1");
    expect(latest?.steps.length).toBeGreaterThanOrEqual(2);
    const items = buildKnowledgeActivityItems({ pipelineRun: latest });
    expect(items.some((i) => i.title.includes("Conversation"))).toBe(true);
  });
});
