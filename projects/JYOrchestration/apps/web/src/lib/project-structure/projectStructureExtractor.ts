import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProjectGraphEventInput } from "@/lib/project-graph/projectGraphProjectionPlan";
import {
  planStructureCandidatesFromEvents,
  type StructureCandidateEdgeDraft,
  type StructureCandidateNodeDraft,
} from "@/lib/project-structure/projectStructureExtractorPlan";
import { STRUCTURE_NODE_LIFECYCLE } from "@/lib/project-structure/projectStructureTypes";

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function upsertCandidateNode(projectId: string, draft: StructureCandidateNodeDraft) {
  const existing = await prisma.projectStructureCandidate.findFirst({
    where: { projectId, idempotencyKey: draft.idempotencyKey },
  });
  if (existing) return existing;

  try {
    return await prisma.projectStructureCandidate.create({
      data: {
        projectId,
        idempotencyKey: draft.idempotencyKey,
        nodeType: draft.nodeType,
        title: draft.title,
        summary: draft.summary,
        lifecycleStatus: STRUCTURE_NODE_LIFECYCLE.CANDIDATE,
        sourceEventId: draft.sourceEventId || null,
        fingerprint: draft.fingerprint,
        metadata: draft.metadata as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return prisma.projectStructureCandidate.findFirst({
        where: { projectId, idempotencyKey: draft.idempotencyKey },
      });
    }
    throw error;
  }
}

async function resolveCandidateIdByNodeKey(projectId: string, nodeKey: string): Promise<string | null> {
  if (nodeKey.startsWith("structure-candidate:")) {
    const row = await prisma.projectStructureCandidate.findFirst({
      where: { projectId, idempotencyKey: nodeKey },
      select: { id: true },
    });
    return row?.id ?? null;
  }
  if (nodeKey.startsWith("entity:")) {
    const entityKey = nodeKey.slice("entity:".length);
    const row = await prisma.projectStructureCandidate.findFirst({
      where: {
        projectId,
        metadata: { path: ["entityKey"], equals: entityKey },
      },
      select: { id: true },
    });
    return row?.id ?? null;
  }
  return null;
}

async function upsertCandidateEdge(projectId: string, draft: StructureCandidateEdgeDraft) {
  const existing = await prisma.projectStructureCandidateEdge.findFirst({
    where: { projectId, idempotencyKey: draft.idempotencyKey },
  });
  if (existing) return existing;

  const fromCandidateId = await resolveCandidateIdByNodeKey(projectId, draft.fromIdempotencyKey);
  const toCandidateId = await resolveCandidateIdByNodeKey(projectId, draft.toIdempotencyKey);
  if (!fromCandidateId || !toCandidateId) return null;

  try {
    return await prisma.projectStructureCandidateEdge.create({
      data: {
        projectId,
        idempotencyKey: draft.idempotencyKey,
        fromCandidateId,
        toCandidateId,
        edgeType: draft.edgeType,
        lifecycleStatus: STRUCTURE_NODE_LIFECYCLE.CANDIDATE,
        sourceEventId: draft.sourceEventId || null,
        metadata: draft.metadata as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return prisma.projectStructureCandidateEdge.findFirst({
        where: { projectId, idempotencyKey: draft.idempotencyKey },
      });
    }
    throw error;
  }
}

export async function loadProjectEventsForStructureExtraction(projectId: string): Promise<ProjectGraphEventInput[]> {
  const events = await prisma.projectEvent.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { projectMessage: { select: { content: true } } },
  });
  return events.map((e) => ({
    id: e.id,
    projectId: e.projectId,
    eventType: e.eventType,
    payload: e.payload,
    sourceMessageId: e.sourceMessageId,
    stage: e.stage,
    messageContent: e.projectMessage?.content ?? null,
  }));
}

/** Event Store replay 기반 idempotent 후보 생성 */
export async function extractStructureCandidatesFromEventStore(projectId: string) {
  const pid = String(projectId).trim();
  const events = await loadProjectEventsForStructureExtraction(pid);
  const plan = planStructureCandidatesFromEvents(events);

  const nodes = [];
  for (const draft of plan.nodes) {
    const row = await upsertCandidateNode(pid, draft);
    if (row) nodes.push(row);
  }

  const edges = [];
  for (const draft of plan.edges) {
    const row = await upsertCandidateEdge(pid, draft);
    if (row) edges.push(row);
  }

  return { eventCount: events.length, nodeCount: nodes.length, edgeCount: edges.length };
}
