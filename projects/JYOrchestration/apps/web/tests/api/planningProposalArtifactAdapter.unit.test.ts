import { describe, expect, it } from "vitest";
import { planningProposalArtifactAdapter } from "@/lib/project-knowledge/planningProposalArtifactAdapter";
import {
  buildPlanningProposalModel,
  planningProposalPayloadFromModel,
} from "@/lib/planning-proposal/planningProposalMapper";

describe("planningProposalArtifactAdapter", () => {
  const proposal = buildPlanningProposalModel({
    projectId: "p1",
    proposalId: "flow::x",
    acceptedSnapshot: "예상 핵심 기능:\n- Dashboard",
    acceptedAt: "2026-06-24T00:00:00.000Z",
    sourceMessageId: "msg-ai",
    acceptedByMessageId: "msg-user",
  });

  it("parses and projects structure candidates", () => {
    const payload = planningProposalPayloadFromModel(proposal);
    const artifact = planningProposalArtifactAdapter.parseEventPayload({
      projectId: "p1",
      payload,
      sourceMessageId: "msg-ai",
    });
    expect(artifact?.proposalId).toBe("flow::x");
    const structure = planningProposalArtifactAdapter.toStructureCandidates({
      eventId: "ev-1",
      artifact: artifact!,
    });
    expect(structure?.nodes.length).toBeGreaterThan(0);
  });

  it("builds activity items", () => {
    const items = planningProposalArtifactAdapter.toActivity({ eventId: "ev-1", artifact: proposal });
    expect(items[0]?.title).toBe("Proposal Approved");
  });
});
