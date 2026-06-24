import { describe, expect, it } from "vitest";
import { planningSnapshotArtifactAdapter } from "@/lib/project-knowledge/planningSnapshotArtifactAdapter";
import { planningSnapshotPayloadFromModel } from "@/lib/planning-snapshot/planningSnapshotMapper";
import type { PlanningSnapshotModel } from "@/lib/planning-snapshot/planningSnapshotModel";

describe("planningSnapshotArtifactAdapter", () => {
  const snapshot: PlanningSnapshotModel = {
    projectId: "p1",
    productName: "App",
    summary: "Summary text",
    problems: ["Pain"],
    actors: ["Admin"],
    features: ["Dashboard"],
    scope: { included: ["MVP"], excluded: [] },
    successCriteria: ["OK"],
    sourceMessageId: "msg-1",
    createdBy: "AI Planner",
  };

  it("parses payload and builds graph projection", () => {
    const payload = planningSnapshotPayloadFromModel(snapshot);
    const artifact = planningSnapshotArtifactAdapter.parseEventPayload({
      projectId: "p1",
      payload,
      sourceMessageId: "msg-1",
    });
    expect(artifact?.productName).toBe("App");
    const graph = planningSnapshotArtifactAdapter.toGraphProjection({
      eventId: "ev-1",
      projectId: "p1",
      artifact: artifact!,
    });
    expect(graph?.nodes.length).toBeGreaterThan(0);
  });

  it("exposes activity and explainability", () => {
    const activity = planningSnapshotArtifactAdapter.toActivity({ eventId: "ev-1", artifact: snapshot });
    expect(activity[0]?.title).toBe("Snapshot Integrated");
    const explain = planningSnapshotArtifactAdapter.toExplainability({ artifact: snapshot });
    expect(explain.reason).toContain("planning snapshot");
  });
});
