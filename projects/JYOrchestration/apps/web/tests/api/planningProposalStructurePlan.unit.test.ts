import { describe, expect, it } from "vitest";
import { buildPlanningProposalModel } from "@/lib/planning-proposal/planningProposalMapper";
import { planStructureCandidatesFromPlanningProposal } from "@/lib/planning-proposal/planningProposalStructurePlan";
import { STRUCTURE_CANDIDATE_NODE_TYPES } from "@/lib/project-structure/projectStructureTypes";

describe("planStructureCandidatesFromPlanningProposal", () => {
  it("creates actor, feature, requirement, and flow candidates with explainability", () => {
    const proposal = buildPlanningProposalModel({
      projectId: "p1",
      proposalId: "sg::hash1",
      acceptedSnapshot: `예상 핵심 기능:\n- 로그인\n\n예상 액터·역할:\n- 관리자\n\n예상 서비스 흐름:\n1. 사용자가 로그인한다.`,
      acceptedAt: new Date().toISOString(),
      sourceMessageId: "msg-ai",
      acceptedByMessageId: "msg-user",
    });
    const plan = planStructureCandidatesFromPlanningProposal("ev-1", proposal);
    const types = plan.nodes.map((n) => n.nodeType);
    expect(types).toContain(STRUCTURE_CANDIDATE_NODE_TYPES.ACTOR);
    expect(types).toContain(STRUCTURE_CANDIDATE_NODE_TYPES.FEATURE);
    expect(types).toContain(STRUCTURE_CANDIDATE_NODE_TYPES.FLOW);
    expect(types).toContain(STRUCTURE_CANDIDATE_NODE_TYPES.REQUIREMENT);
    const actor = plan.nodes.find((n) => n.nodeType === STRUCTURE_CANDIDATE_NODE_TYPES.ACTOR);
    const meta = actor?.metadata as { explainability?: { reason?: string }; planningProposal?: boolean };
    expect(meta?.planningProposal).toBe(true);
    expect(meta?.explainability?.reason).toContain("추천안 적용");
  });
});
