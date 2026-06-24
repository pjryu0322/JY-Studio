import { describe, expect, it } from "vitest";
import { bootstrapProjectKnowledgeArtifactAdapters } from "@/lib/project-knowledge/projectKnowledgeArtifactAdapterBootstrap";
import { projectGraphProjectionHandlers } from "@/lib/project-graph/projectGraphProjectionRegistry";
import { planProjectGraphProjectionFromEvent } from "@/lib/project-graph/projectGraphProjectionPlan";
import { PROJECT_GRAPH_EVENT_TYPES, PROJECT_GRAPH_NODE_TYPES } from "@/lib/project-graph/projectGraphTypes";
import { planningSnapshotPayloadFromModel } from "@/lib/planning-snapshot/planningSnapshotMapper";
import type { PlanningSnapshotModel } from "@/lib/planning-snapshot/planningSnapshotModel";
import { planningProposalPayloadFromModel, buildPlanningProposalModel } from "@/lib/planning-proposal/planningProposalMapper";

describe("projectGraphProjectionRegistry", () => {
  bootstrapProjectKnowledgeArtifactAdapters();

  it("registers planning.snapshot_created handler", () => {
    expect(projectGraphProjectionHandlers[PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED]).toBeTypeOf("function");
  });

  it("handles planning.snapshot_created via registry path", () => {
    const snapshot: PlanningSnapshotModel = {
      projectId: "p1",
      productName: "App",
      summary: "Summary",
      problems: ["Pain"],
      actors: ["User"],
      features: ["Dashboard"],
      scope: { included: ["MVP"], excluded: [] },
      successCriteria: ["Launch"],
      sourceMessageId: "msg-1",
      createdBy: "AI",
    };
    const payload = planningSnapshotPayloadFromModel(snapshot);
    const plan = planProjectGraphProjectionFromEvent({
      id: "ev-1",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED,
      payload,
      sourceMessageId: "msg-1",
    });
    expect(plan.nodes.length).toBeGreaterThan(0);
  });

  it("handles planning.proposal_approved via registry path", () => {
    const proposal = buildPlanningProposalModel({
      projectId: "p1",
      proposalId: "flow::x",
      acceptedSnapshot: "예상 핵심 기능:\n- A",
      acceptedAt: "2026-06-23T00:00:00.000Z",
      sourceMessageId: "msg-ai",
      acceptedByMessageId: "msg-user",
    });
    const plan = planProjectGraphProjectionFromEvent({
      id: "ev-2",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED,
      payload: planningProposalPayloadFromModel(proposal),
      sourceMessageId: "msg-ai",
    });
    const types = plan.nodes.map((n) => n.nodeType);
    expect(types).toContain(PROJECT_GRAPH_NODE_TYPES.FEATURE);
  });

  it("fallback switch still handles conversation.message_created", () => {
    const plan = planProjectGraphProjectionFromEvent({
      id: "ev-3",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.CONVERSATION_MESSAGE_CREATED,
      payload: { sourceMessageId: "m1", stage: "requirements_ideation" },
      sourceMessageId: "m1",
      messageContent: "hello requirement",
    });
    expect(plan.nodes.some((n) => n.nodeType === PROJECT_GRAPH_NODE_TYPES.REQUIREMENT)).toBe(true);
  });
});
