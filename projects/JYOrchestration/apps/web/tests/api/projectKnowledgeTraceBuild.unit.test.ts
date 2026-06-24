import { describe, expect, it, vi, beforeEach } from "vitest";

const findGraphNodeMock = vi.fn();
const findEventMock = vi.fn();
const findMessageMock = vi.fn();
const findCandidateMock = vi.fn();
const resolveExplainMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    projectGraphNode: { findFirst: (...args: unknown[]) => findGraphNodeMock(...args) },
    projectEvent: { findFirst: (...args: unknown[]) => findEventMock(...args) },
    projectMessage: { findFirst: (...args: unknown[]) => findMessageMock(...args) },
    projectStructureCandidate: { findFirst: (...args: unknown[]) => findCandidateMock(...args) },
  },
}));

vi.mock("@/lib/project-structure/projectStructureExplainabilityService", () => ({
  resolveExplainabilityForGraphNode: (...args: unknown[]) => resolveExplainMock(...args),
}));

import { buildKnowledgeTrace } from "@/lib/project-knowledge/projectKnowledgeTraceService";

describe("buildKnowledgeTrace", () => {
  beforeEach(() => {
    findGraphNodeMock.mockReset();
    findEventMock.mockReset();
    findMessageMock.mockReset();
    findCandidateMock.mockReset();
    resolveExplainMock.mockReset();
  });

  it("returns warning when node not found", async () => {
    findGraphNodeMock.mockResolvedValue(null);
    const result = await buildKnowledgeTrace("p1", "missing");
    expect(result.warnings).toContain("GRAPH_NODE_NOT_FOUND");
    expect(result.lineage).toHaveLength(0);
  });

  it("returns warning for missing project or node id", async () => {
    const result = await buildKnowledgeTrace("", "");
    expect(result.warnings).toContain("MISSING_PROJECT_OR_NODE_ID");
  });

  it("builds lineage for graph node with event and candidate", async () => {
    findGraphNodeMock.mockResolvedValue({
      id: "node-1",
      nodeType: "Feature",
      title: "회의록 업로드",
      summary: "",
      metadata: { structureCandidateId: "cand-1" },
      sourceEventId: "ev-1",
      createdAt: new Date("2026-06-24T10:00:00.000Z"),
      updatedAt: new Date("2026-06-24T10:05:00.000Z"),
    });
    resolveExplainMock.mockResolvedValue({
      confidence: 80,
      confidenceLabel: "HIGH",
      reason: "r",
      confidenceReason: "",
      sourceConversation: { excerpt: "ex", messageId: "msg-1", href: null },
      sourceEvent: { eventType: "planning.proposal_approved", eventId: "ev-1" },
      createdBy: "AI",
      createdFrom: { eventId: "ev-1", messageId: "msg-1" },
      relatedNodes: [],
      relatedArtifacts: {
        reviews: [],
        screens: [],
        features: [],
        flows: [],
        tasks: [],
        changeRequests: [],
      },
    });
    findEventMock.mockResolvedValue({
      id: "ev-1",
      eventType: "planning.proposal_approved",
      actorType: "USER",
      actorId: "u1",
      sourceMessageId: "msg-ai",
      createdAt: new Date("2026-06-24T09:30:00.000Z"),
      payload: { features: ["회의록 업로드"], acceptedBy: "USER" },
    });
    findMessageMock.mockResolvedValue({
      sourceMessageId: "msg-1",
      senderType: "user",
      content: "회의록 자동 분류",
      messageCreatedAt: new Date("2026-06-24T09:00:00.000Z"),
    });
    findCandidateMock.mockResolvedValue({
      id: "cand-1",
      nodeType: "Feature",
      title: "upload-meeting",
      summary: "",
      lifecycleStatus: "APPROVED",
      sourceEventId: "ev-1",
      createdAt: new Date("2026-06-24T09:40:00.000Z"),
    });

    const result = await buildKnowledgeTrace("p1", "node-1");
    expect(result.nodeId).toBe("node-1");
    expect(result.lineage.length).toBeGreaterThan(2);
    expect(result.lineage.some((s) => s.type === "graph-node")).toBe(true);
    expect(result.lineage.some((s) => s.type === "candidate")).toBe(true);
  });

  it("warns when source event missing", async () => {
    findGraphNodeMock.mockResolvedValue({
      id: "node-1",
      nodeType: "Feature",
      title: "T",
      summary: "",
      metadata: {},
      sourceEventId: "ev-missing",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    resolveExplainMock.mockResolvedValue({
      confidence: 50,
      confidenceLabel: "MEDIUM",
      reason: "r",
      confidenceReason: "",
      sourceConversation: { excerpt: "—", messageId: null, href: null },
      sourceEvent: { eventType: "unknown", eventId: null },
      createdBy: "AI",
      createdFrom: { eventId: null, messageId: null },
      relatedNodes: [],
      relatedArtifacts: {
        reviews: [],
        screens: [],
        features: [],
        flows: [],
        tasks: [],
        changeRequests: [],
      },
    });
    findEventMock.mockResolvedValue(null);

    const result = await buildKnowledgeTrace("p1", "node-1");
    expect(result.warnings).toContain("SOURCE_EVENT_NOT_FOUND");
  });
});
