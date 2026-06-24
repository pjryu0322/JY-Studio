import { prisma } from "@/lib/prisma";
import { PROJECT_EVENT_TYPES } from "@/lib/project-process/projectEventTypes";
import {
  buildKnowledgeTraceLineage,
  type TraceEventRow,
  type TraceMessageRow,
} from "@/lib/project-knowledge/projectKnowledgeTraceBuilders";
import { resolveExplainabilityForGraphNode } from "@/lib/project-structure/projectStructureExplainabilityService";
import type { ProjectKnowledgeTraceResult } from "@/lib/project-knowledge/projectKnowledgeTraceTypes";

function readMetaString(meta: unknown, key: string): string {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "";
  return String((meta as Record<string, unknown>)[key] ?? "").trim();
}

async function loadMessageBySourceMessageId(
  projectId: string,
  sourceMessageId: string | null | undefined,
): Promise<TraceMessageRow | null> {
  const mid = String(sourceMessageId ?? "").trim();
  if (!mid) return null;
  const row = await prisma.projectMessage.findFirst({
    where: { projectId, sourceMessageId: mid },
    select: {
      sourceMessageId: true,
      senderType: true,
      content: true,
      messageCreatedAt: true,
    },
  });
  if (!row) return null;
  return {
    sourceMessageId: row.sourceMessageId,
    senderType: row.senderType,
    content: row.content,
    messageCreatedAt: row.messageCreatedAt,
  };
}

function mapEvent(row: {
  id: string;
  eventType: string;
  actorType: string;
  actorId: string | null;
  sourceMessageId: string | null;
  createdAt: Date;
  payload: unknown;
}): TraceEventRow {
  return {
    id: row.id,
    eventType: row.eventType,
    actorType: row.actorType,
    actorId: row.actorId,
    sourceMessageId: row.sourceMessageId,
    createdAt: row.createdAt,
    payload: row.payload,
  };
}

export async function buildKnowledgeTrace(
  projectId: string,
  nodeId: string,
): Promise<ProjectKnowledgeTraceResult> {
  const pid = String(projectId ?? "").trim();
  const nid = String(nodeId ?? "").trim();
  const warnings: string[] = [];

  if (!pid || !nid) {
    return { nodeId: nid, lineage: [], warnings: ["MISSING_PROJECT_OR_NODE_ID"] };
  }

  const node = await prisma.projectGraphNode.findFirst({
    where: { projectId: pid, id: nid },
  });
  if (!node) {
    return { nodeId: nid, lineage: [], warnings: ["GRAPH_NODE_NOT_FOUND"] };
  }

  const structureCandidateId = readMetaString(node.metadata, "structureCandidateId");
  const explainability = await resolveExplainabilityForGraphNode(pid, node);

  const sourceEvent = node.sourceEventId
    ? await prisma.projectEvent.findFirst({ where: { projectId: pid, id: node.sourceEventId } })
    : null;

  if (node.sourceEventId && !sourceEvent) {
    warnings.push("SOURCE_EVENT_NOT_FOUND");
  }

  const messageId =
    explainability.createdFrom.messageId ??
    explainability.sourceConversation.messageId ??
    sourceEvent?.sourceMessageId ??
    null;

  const conversationMessage = await loadMessageBySourceMessageId(pid, messageId);

  if (messageId && !conversationMessage) {
    warnings.push("CONVERSATION_MESSAGE_NOT_FOUND");
  }

  let proposalSourceMessage: TraceMessageRow | null = null;
  if (sourceEvent?.eventType === PROJECT_EVENT_TYPES.PLANNING_PROPOSAL_APPROVED) {
    const payload = sourceEvent.payload;
    const srcMid =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? String((payload as Record<string, unknown>).sourceMessageId ?? "").trim()
        : "";
    if (srcMid) {
      proposalSourceMessage = await loadMessageBySourceMessageId(pid, srcMid);
    }
  }

  const candidate = structureCandidateId
    ? await prisma.projectStructureCandidate.findFirst({
        where: { projectId: pid, id: structureCandidateId },
      })
    : null;

  if (structureCandidateId && !candidate) {
    warnings.push("STRUCTURE_CANDIDATE_NOT_FOUND");
  }

  const lineage = buildKnowledgeTraceLineage({
    node: {
      id: node.id,
      nodeType: node.nodeType,
      title: node.title,
      summary: node.summary,
      sourceEventId: node.sourceEventId,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
    },
    explainability,
    structureCandidateId: structureCandidateId || null,
    candidate: candidate
      ? {
          id: candidate.id,
          nodeType: candidate.nodeType,
          title: candidate.title,
          summary: candidate.summary,
          lifecycleStatus: candidate.lifecycleStatus,
          sourceEventId: candidate.sourceEventId,
          createdAt: candidate.createdAt,
        }
      : null,
    sourceEvent: sourceEvent ? mapEvent(sourceEvent) : null,
    conversationMessage,
    proposalSourceMessage,
  });

  if (!lineage.length) {
    warnings.push("EMPTY_LINEAGE");
  }

  return { nodeId: nid, lineage, warnings };
}
