import { describe, expect, it } from "vitest";
import { planProjectGraphProjectionFromEvent } from "@/lib/project-graph/projectGraphProjectionPlan";
import { PROJECT_GRAPH_EVENT_TYPES, PROJECT_GRAPH_NODE_TYPES } from "@/lib/project-graph/projectGraphTypes";
import { planningProposalPayloadFromModel } from "@/lib/planning-proposal/planningProposalMapper";
import { buildPlanningProposalModel } from "@/lib/planning-proposal/planningProposalMapper";
import { planStructureCandidatesFromEvent } from "@/lib/project-structure/projectStructureExtractorPlan";

describe("planning.proposal_approved integration", () => {
  const proposal = buildPlanningProposalModel({
    projectId: "p1",
    proposalId: "flow::abc",
    acceptedSnapshot: "예상 핵심 기능:\n- 대시보드\n\n예상 액터·역할:\n- 운영자",
    acceptedAt: "2026-06-23T15:35:00.000Z",
    sourceMessageId: "msg-ai",
    acceptedByMessageId: "msg-user",
  });
  const payload = planningProposalPayloadFromModel(proposal);

  it("projects graph nodes for approved proposal", () => {
    const plan = planProjectGraphProjectionFromEvent({
      id: "ev-prop",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED,
      payload,
      sourceMessageId: "msg-ai",
    });
    const types = plan.nodes.map((n) => n.nodeType);
    expect(types).toContain(PROJECT_GRAPH_NODE_TYPES.ACTOR);
    expect(types).toContain(PROJECT_GRAPH_NODE_TYPES.FEATURE);
    expect(plan.edges.length).toBeGreaterThan(0);
  });

  it("extracts structure candidates from proposal event", () => {
    const plan = planStructureCandidatesFromEvent({
      id: "ev-prop",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED,
      payload,
      sourceMessageId: "msg-ai",
    });
    expect(plan.nodes.length).toBeGreaterThan(2);
  });
});
