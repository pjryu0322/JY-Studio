import type { ProjectGraphNode, ProjectStructureCandidate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildStructureCandidateExplainability,
  type ExplainabilityBuildInput,
} from "@/lib/project-structure/projectStructureExplainability";
import { listProjectGraphEdges, listProjectGraphNodes } from "@/lib/project-graph/projectGraphQuery";
import { collectRelatedNodesForGraphNode } from "@/lib/project-structure/projectStructureExplainabilityRelations";
import {
  mergeExplainabilityContext,
  toStructureExplainability,
  type StructureExplainability,
} from "@/lib/project-structure/structureExplainabilityModel";
import type { StructureCandidateRow } from "@/lib/project-structure/structureReviewUiTypes";

function readPayloadString(payload: unknown, key: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  return String((payload as Record<string, unknown>)[key] ?? "").trim();
}

function readMetaString(meta: unknown, key: string): string {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "";
  return String((meta as Record<string, unknown>)[key] ?? "").trim();
}

export function resolveExplainabilityFromBuildInput(
  input: ExplainabilityBuildInput,
): StructureExplainability {
  return toStructureExplainability(buildStructureCandidateExplainability(input));
}

export function resolveExplainabilityForCandidateRow(
  row: StructureCandidateRow,
): StructureExplainability | null {
  if (row.explainability) {
    return toStructureExplainability(row.explainability as never);
  }
  if (!row.reason && row.confidence == null) return null;
  return toStructureExplainability({
    confidence: Number(row.confidence ?? 0),
    confidenceLabel: (row.confidenceLabel as "High" | "Medium" | "Low") ?? "Medium",
    reason: String(row.reason ?? ""),
    confidenceReason: "",
    sourceConversation: row.sourceConversation ?? { excerpt: "—", messageId: null, href: null },
    sourceEvent: row.sourceEvent ?? { eventType: "", eventId: null },
    createdBy: row.createdBy ?? "AI Structure Engine",
    createdFrom: row.createdFrom ?? { eventId: null, messageId: null },
  });
}

async function loadEventContext(projectId: string, sourceEventId: string | null) {
  if (!sourceEventId) return null;
  return prisma.projectEvent.findFirst({
    where: { projectId, id: sourceEventId },
    include: { projectMessage: { select: { content: true, sourceMessageId: true } } },
  });
}

export async function resolveExplainabilityForGraphNode(
  projectId: string,
  node: Pick<
    ProjectGraphNode,
    "id" | "nodeType" | "title" | "summary" | "metadata" | "sourceEventId" | "projectionKey"
  >,
): Promise<StructureExplainability> {
  const pid = String(projectId).trim();
  const event = await loadEventContext(pid, node.sourceEventId);
  const messageContent = event?.projectMessage?.content ?? null;
  const sourceMessageId =
    event?.sourceMessageId ??
    event?.projectMessage?.sourceMessageId ??
    (readPayloadString(event?.payload, "sourceMessageId") ||
      readMetaString(node.metadata, "sourceMessageId") ||
      null);

  const approved = readMetaString(node.metadata, "structureCandidateId");
  const reasonSuffix = node.projectionKey.startsWith("approved-candidate:")
    ? "승인된 구조 후보가 Graph Projection에 반영되었습니다."
    : "Event Store 기반 Graph Projection으로 노드가 생성되었습니다.";

  const built = resolveExplainabilityFromBuildInput({
    projectId: pid,
    nodeType: node.nodeType,
    title: node.title,
    summary: node.summary,
    metadata: node.metadata,
    sourceEventId: node.sourceEventId,
    eventType: event?.eventType ?? null,
    messageContent,
    sourceMessageId,
  });

  if (approved) {
    return {
      ...built,
      reason: `${built.reason} ${reasonSuffix}`,
      createdBy: built.createdBy,
    };
  }

  return {
    ...built,
    reason: built.reason.includes("Graph") ? built.reason : `${built.reason} ${reasonSuffix}`,
  };
}

export async function enrichGraphNodesWithExplainability(
  projectId: string,
  nodes: readonly ProjectGraphNode[],
  edges?: readonly import("@prisma/client").ProjectGraphEdge[],
) {
  const pid = String(projectId).trim();
  const edgeList =
    edges ??
    (await listProjectGraphEdges(pid, { limit: 500 }));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const out = [];
  for (const node of nodes) {
    let explainability = await resolveExplainabilityForGraphNode(pid, node);
    const relatedNodes = collectRelatedNodesForGraphNode(node.id, edgeList, nodeById);
    explainability = mergeExplainabilityContext(explainability, { relatedNodes });
    const lifecycleStatus = await resolveGraphNodeLifecycleStatus(pid, node);
    out.push({ ...node, explainability, lifecycleStatus });
  }
  return out;
}

export async function resolveGraphNodeLifecycleStatus(
  projectId: string,
  node: Pick<ProjectGraphNode, "metadata" | "projectionKey">,
): Promise<string> {
  const candidateId = readMetaString(node.metadata, "structureCandidateId");
  if (candidateId) {
    const row = await prisma.projectStructureCandidate.findFirst({
      where: { projectId, id: candidateId },
      select: { lifecycleStatus: true },
    });
    if (row) return row.lifecycleStatus;
  }
  if (String(node.projectionKey ?? "").startsWith("approved-candidate:")) {
    return "APPROVED";
  }
  return "PROJECTED";
}

export async function enrichStructureCandidatesWithExplainabilityService(
  projectId: string,
  candidates: readonly ProjectStructureCandidate[],
) {
  const pid = String(projectId).trim();
  const eventIds = [
    ...new Set(candidates.map((c) => String(c.sourceEventId ?? "").trim()).filter(Boolean)),
  ];

  const events =
    eventIds.length === 0
      ? []
      : await prisma.projectEvent.findMany({
          where: { projectId: pid, id: { in: eventIds } },
          include: { projectMessage: { select: { content: true, sourceMessageId: true } } },
        });

  const eventById = new Map(events.map((e) => [e.id, e]));

  const graphNodes = await listProjectGraphNodes(pid, { limit: 500 });
  const graphEdges = await listProjectGraphEdges(pid, { limit: 500 });
  const graphNodeById = new Map(graphNodes.map((n) => [n.id, n]));

  return candidates.map((c) => {
    const event = c.sourceEventId ? eventById.get(c.sourceEventId) : null;
    const messageContent = event?.projectMessage?.content ?? null;
    const sourceMessageId =
      event?.sourceMessageId ??
      event?.projectMessage?.sourceMessageId ??
      (readPayloadString(event?.payload, "sourceMessageId") || null);

    let explainability = resolveExplainabilityFromBuildInput({
      projectId: pid,
      nodeType: c.nodeType,
      title: c.title,
      summary: c.summary,
      metadata: c.metadata,
      sourceEventId: c.sourceEventId,
      eventType: event?.eventType ?? null,
      messageContent,
      sourceMessageId,
    });

    const graphNodeId = String(c.approvedGraphNodeId ?? "").trim();
    if (graphNodeId && graphNodeById.has(graphNodeId)) {
      const relatedNodes = collectRelatedNodesForGraphNode(graphNodeId, graphEdges, graphNodeById);
      explainability = mergeExplainabilityContext(explainability, { relatedNodes });
    }

    return {
      ...c,
      ...explainability,
      explainability,
    };
  });
}
