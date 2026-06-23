import { describe, expect, it, vi, beforeEach } from "vitest";

const syncConversationMock = vi.fn();
const snapshotIntegrateMock = vi.fn();
const proposalIntegrateMock = vi.fn();
const postProcessMock = vi.fn();

vi.mock("@/lib/project-process/projectEventStore", () => ({
  syncRequirementsConversationMessagesToEventStore: (...args: unknown[]) => syncConversationMock(...args),
}));

vi.mock("@/lib/planning-snapshot/planningSnapshotConversationIntegrate", () => ({
  integratePlanningSnapshotsAfterConversationSync: (...args: unknown[]) => snapshotIntegrateMock(...args),
}));

vi.mock("@/lib/planning-proposal/planningProposalConversationIntegrate", () => ({
  integratePlanningProposalApprovalFromRequirementsState: (...args: unknown[]) => proposalIntegrateMock(...args),
}));

vi.mock("@/lib/project-knowledge/projectKnowledgePostProcess", () => ({
  runProjectKnowledgePostProcess: (...args: unknown[]) => postProcessMock(...args),
}));

import { runProjectKnowledgePipeline } from "@/lib/project-knowledge/projectKnowledgePipeline";

describe("runProjectKnowledgePipeline", () => {
  beforeEach(() => {
    syncConversationMock.mockReset();
    snapshotIntegrateMock.mockReset();
    proposalIntegrateMock.mockReset();
    postProcessMock.mockReset();
    syncConversationMock.mockResolvedValue({ syncedCount: 0, results: [] });
    snapshotIntegrateMock.mockResolvedValue({ integrated: false });
    proposalIntegrateMock.mockResolvedValue({ integrated: false });
    postProcessMock.mockResolvedValue({ ok: true, candidateSync: "ok", graphSync: "queued" });
  });

  it("calls conversation sync and snapshot integration when conversation is provided", async () => {
    await runProjectKnowledgePipeline({} as never, {
      projectId: "p1",
      trigger: "requirements_saved",
      nextConversationJson: { messages: [] },
      runProposalIntegration: false,
    });
    expect(syncConversationMock).toHaveBeenCalled();
    expect(snapshotIntegrateMock).toHaveBeenCalled();
    expect(postProcessMock).toHaveBeenCalled();
  });

  it("calls proposal integration when enabled", async () => {
    await runProjectKnowledgePipeline({} as never, {
      projectId: "p1",
      trigger: "requirements_saved",
      requirementsStateJson: {},
      runConversationSync: false,
      runProposalIntegration: true,
    });
    expect(proposalIntegrateMock).toHaveBeenCalled();
    expect(postProcessMock).toHaveBeenCalled();
  });

  it("collects event ids for post process", async () => {
    snapshotIntegrateMock.mockResolvedValue({ integrated: true, eventId: "ev-snap" });
    proposalIntegrateMock.mockResolvedValue({ integrated: true, eventId: "ev-prop" });
    await runProjectKnowledgePipeline({} as never, {
      projectId: "p1",
      trigger: "requirements_saved",
      nextConversationJson: { messages: [] },
      requirementsStateJson: {},
      runProposalIntegration: true,
    });
    expect(postProcessMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventIds: expect.arrayContaining(["ev-snap", "ev-prop"]) }),
    );
  });
});
