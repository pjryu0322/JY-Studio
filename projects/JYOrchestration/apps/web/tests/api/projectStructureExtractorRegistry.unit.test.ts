import { describe, expect, it } from "vitest";
import { structureCandidateHandlers } from "@/lib/project-structure/projectStructureExtractorRegistry";
import { planStructureCandidatesFromEvent } from "@/lib/project-structure/projectStructureExtractorPlan";
import { PROJECT_GRAPH_EVENT_TYPES } from "@/lib/project-graph/projectGraphTypes";
import { planningSnapshotPayloadFromModel } from "@/lib/planning-snapshot/planningSnapshotMapper";
import type { PlanningSnapshotModel } from "@/lib/planning-snapshot/planningSnapshotModel";
import { buildPlanningProposalModel, planningProposalPayloadFromModel } from "@/lib/planning-proposal/planningProposalMapper";

describe("projectStructureExtractorRegistry", () => {
  it("registers artifact event handlers", () => {
    expect(structureCandidateHandlers[PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED]).toBeTypeOf("function");
    expect(structureCandidateHandlers[PROJECT_GRAPH_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED]).toBeTypeOf("function");
  });

  it("handles planning.snapshot_created via registry", () => {
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
    const plan = planStructureCandidatesFromEvent({
      id: "ev-1",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED,
      payload: planningSnapshotPayloadFromModel(snapshot),
      sourceMessageId: "msg-1",
    });
    expect(plan.nodes.length).toBeGreaterThan(0);
  });

  it("handles planning.proposal_approved via registry", () => {
    const proposal = buildPlanningProposalModel({
      projectId: "p1",
      proposalId: "flow::x",
      acceptedSnapshot: "예상 핵심 기능:\n- A",
      acceptedAt: "2026-06-23T00:00:00.000Z",
      sourceMessageId: "msg-ai",
      acceptedByMessageId: "msg-user",
    });
    const plan = planStructureCandidatesFromEvent({
      id: "ev-2",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED,
      payload: planningProposalPayloadFromModel(proposal),
      sourceMessageId: "msg-ai",
    });
    expect(plan.nodes.length).toBeGreaterThan(1);
  });

  it("fallback still derives candidates from graph projection for idea.created", () => {
    const plan = planStructureCandidatesFromEvent({
      id: "ev-3",
      projectId: "p1",
      eventType: PROJECT_GRAPH_EVENT_TYPES.IDEA_CREATED,
      payload: { name: "My idea", description: "Desc" },
    });
    expect(plan.nodes.length).toBeGreaterThan(0);
  });
});
