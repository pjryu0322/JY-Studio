import { describe, expect, it } from "vitest";
import { PROJECT_EVENT_TYPES } from "@/lib/project-process/projectEventTypes";
import { buildKnowledgeTraceLineage } from "@/lib/project-knowledge/projectKnowledgeTraceBuilders";
import { toStructureExplainability } from "@/lib/project-structure/structureExplainabilityModel";

const baseExplainability = toStructureExplainability({
  confidence: 80,
  confidenceLabel: "High",
  reason: "test",
  confidenceReason: "",
  sourceConversation: { excerpt: "회의록 자동 분류", messageId: "msg-1", href: null },
  sourceEvent: { eventType: "planning.proposal_approved", eventId: "ev-1" },
  createdBy: "AI",
  createdFrom: { eventId: "ev-1", messageId: "msg-1" },
});

const baseNode = {
  id: "node-1",
  nodeType: "Feature",
  title: "회의록 업로드",
  summary: "",
  sourceEventId: "ev-1",
  createdAt: new Date("2026-06-24T10:00:00.000Z"),
  updatedAt: new Date("2026-06-24T10:05:00.000Z"),
};

describe("buildKnowledgeTraceLineage", () => {
  it("includes conversation step from explainability", () => {
    const lineage = buildKnowledgeTraceLineage({
      node: baseNode,
      explainability: baseExplainability,
      structureCandidateId: null,
      candidate: null,
      sourceEvent: null,
      conversationMessage: {
        sourceMessageId: "msg-1",
        senderType: "user",
        content: "회의록 자동 분류가 필요합니다",
        messageCreatedAt: new Date("2026-06-24T09:00:00.000Z"),
      },
      proposalSourceMessage: null,
    });
    expect(lineage.some((s) => s.type === "conversation")).toBe(true);
    expect(lineage[0]?.type).toBe("conversation");
  });

  it("includes proposal and approval for proposal_approved event", () => {
    const lineage = buildKnowledgeTraceLineage({
      node: baseNode,
      explainability: baseExplainability,
      structureCandidateId: null,
      candidate: null,
      sourceEvent: {
        id: "ev-1",
        eventType: PROJECT_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED,
        actorType: "USER",
        actorId: "user-1",
        sourceMessageId: "msg-ai",
        createdAt: new Date("2026-06-24T09:30:00.000Z"),
        payload: {
          proposalId: "prop-1",
          features: ["회의록 업로드"],
          acceptedBy: "USER",
          acceptedByMessageId: "msg-user",
          sourceMessageId: "msg-ai",
        },
      },
      conversationMessage: null,
      proposalSourceMessage: null,
    });
    expect(lineage.some((s) => s.type === "proposal")).toBe(true);
    expect(lineage.some((s) => s.type === "event" && s.title === "사용자 승인")).toBe(true);
  });

  it("includes snapshot step for snapshot_created event", () => {
    const lineage = buildKnowledgeTraceLineage({
      node: { ...baseNode, sourceEventId: "ev-snap" },
      explainability: baseExplainability,
      structureCandidateId: null,
      candidate: null,
      sourceEvent: {
        id: "ev-snap",
        eventType: PROJECT_EVENT_TYPES.PLANNING_SNAPSHOT_CREATED,
        actorType: "SYSTEM",
        actorId: null,
        sourceMessageId: null,
        createdAt: new Date("2026-06-24T09:10:00.000Z"),
        payload: { snapshotTitle: "요구사항 스냅샷" },
      },
      conversationMessage: null,
      proposalSourceMessage: null,
    });
    expect(lineage.some((s) => s.type === "snapshot")).toBe(true);
  });

  it("includes candidate step when candidate row provided", () => {
    const lineage = buildKnowledgeTraceLineage({
      node: baseNode,
      explainability: baseExplainability,
      structureCandidateId: "cand-1",
      candidate: {
        id: "cand-1",
        nodeType: "Feature",
        title: "upload-meeting",
        summary: "",
        lifecycleStatus: "APPROVED",
        sourceEventId: "ev-1",
        createdAt: new Date("2026-06-24T09:40:00.000Z"),
      },
      sourceEvent: null,
      conversationMessage: null,
      proposalSourceMessage: null,
    });
    const cand = lineage.find((s) => s.type === "candidate");
    expect(cand?.summary).toContain("Feature");
  });

  it("includes projection and graph-node terminal steps", () => {
    const lineage = buildKnowledgeTraceLineage({
      node: baseNode,
      explainability: baseExplainability,
      structureCandidateId: null,
      candidate: null,
      sourceEvent: null,
      conversationMessage: null,
      proposalSourceMessage: null,
    });
    expect(lineage[lineage.length - 1]?.type).toBe("graph-node");
    expect(lineage.some((s) => s.type === "projection")).toBe(true);
  });

  it("ends with graph node title in summary", () => {
    const lineage = buildKnowledgeTraceLineage({
      node: baseNode,
      explainability: baseExplainability,
      structureCandidateId: null,
      candidate: null,
      sourceEvent: null,
      conversationMessage: null,
      proposalSourceMessage: null,
    });
    expect(lineage[lineage.length - 1]?.summary).toBe("회의록 업로드");
  });

  it("adds placeholder candidate when only id known", () => {
    const lineage = buildKnowledgeTraceLineage({
      node: baseNode,
      explainability: baseExplainability,
      structureCandidateId: "cand-missing",
      candidate: null,
      sourceEvent: null,
      conversationMessage: null,
      proposalSourceMessage: null,
    });
    expect(lineage.some((s) => s.sourceArtifactId === "cand-missing")).toBe(true);
  });

  it("conversation message_created event adds conversation when missing", () => {
    const ex = toStructureExplainability({
      ...baseExplainability,
      sourceConversation: { excerpt: "—", messageId: null, href: null },
      createdFrom: { eventId: null, messageId: null },
    });
    const lineage = buildKnowledgeTraceLineage({
      node: { ...baseNode, sourceEventId: "ev-conv" },
      explainability: ex,
      structureCandidateId: null,
      candidate: null,
      sourceEvent: {
        id: "ev-conv",
        eventType: PROJECT_EVENT_TYPES.CONVERSATION_MESSAGE_CREATED,
        actorType: "user",
        actorId: null,
        sourceMessageId: "msg-x",
        createdAt: new Date(),
        payload: {},
      },
      conversationMessage: {
        sourceMessageId: "msg-x",
        senderType: "user",
        content: "hello",
        messageCreatedAt: new Date(),
      },
      proposalSourceMessage: null,
    });
    expect(lineage.some((s) => s.type === "conversation")).toBe(true);
  });
});

describe("buildKnowledgeTrace service contract", () => {
  it("lineage order places graph-node last", () => {
    const lineage = buildKnowledgeTraceLineage({
      node: baseNode,
      explainability: baseExplainability,
      structureCandidateId: "c1",
      candidate: {
        id: "c1",
        nodeType: "Feature",
        title: "f",
        summary: "",
        lifecycleStatus: "CANDIDATE",
        sourceEventId: "ev-1",
        createdAt: new Date(),
      },
      sourceEvent: {
        id: "ev-1",
        eventType: PROJECT_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED,
        actorType: "USER",
        actorId: null,
        sourceMessageId: null,
        createdAt: new Date(),
        payload: { features: ["a"] },
      },
      conversationMessage: null,
      proposalSourceMessage: null,
    });
    const types = lineage.map((s) => s.type);
    expect(types[types.length - 1]).toBe("graph-node");
  });
});
