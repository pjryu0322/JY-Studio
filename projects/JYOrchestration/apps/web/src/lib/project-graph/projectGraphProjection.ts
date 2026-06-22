import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  planProjectGraphProjectionFromEvent,
  type ProjectGraphEventInput,
} from "@/lib/project-graph/projectGraphProjectionPlan";

export type ProjectGraphDbClient = Prisma.TransactionClient | typeof prisma;

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function resolveNodeIdByEntityKey(
  db: ProjectGraphDbClient,
  projectId: string,
  entityKey: string,
): Promise<string | null> {
  const row = await db.projectGraphNode.findFirst({
    where: { projectId, entityKey },
    select: { id: true },
  });
  return row?.id ?? null;
}

async function upsertNodeFromPlan(
  db: ProjectGraphDbClient,
  projectId: string,
  plan: ReturnType<typeof planProjectGraphProjectionFromEvent>["nodes"][number],
) {
  const existing = await db.projectGraphNode.findFirst({
    where: { projectId, projectionKey: plan.projectionKey },
  });
  if (existing) return existing;

  try {
    return await db.projectGraphNode.create({
      data: {
        projectId,
        projectionKey: plan.projectionKey,
        entityKey: plan.entityKey,
        nodeType: plan.nodeType,
        title: plan.title,
        summary: plan.summary,
        metadata: plan.metadata as Prisma.InputJsonValue,
        sourceEventId: plan.sourceEventId,
      },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      const byProjection = await db.projectGraphNode.findFirst({
        where: { projectId, projectionKey: plan.projectionKey },
      });
      if (byProjection) return byProjection;
      const byEntity = await db.projectGraphNode.findFirst({
        where: { projectId, entityKey: plan.entityKey },
      });
      if (byEntity) return byEntity;
    }
    throw error;
  }
}

async function upsertEdgeFromPlan(
  db: ProjectGraphDbClient,
  projectId: string,
  plan: ReturnType<typeof planProjectGraphProjectionFromEvent>["edges"][number],
) {
  const existing = await db.projectGraphEdge.findFirst({
    where: { projectId, projectionKey: plan.projectionKey },
  });
  if (existing) return existing;

  const fromNodeId = await resolveNodeIdByEntityKey(db, projectId, plan.fromEntityKey);
  const toNodeId = await resolveNodeIdByEntityKey(db, projectId, plan.toEntityKey);
  if (!fromNodeId || !toNodeId) return null;

  try {
    return await db.projectGraphEdge.create({
      data: {
        projectId,
        projectionKey: plan.projectionKey,
        fromNodeId,
        toNodeId,
        edgeType: plan.edgeType,
        metadata: plan.metadata as Prisma.InputJsonValue,
        sourceEventId: plan.sourceEventId,
      },
    });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return db.projectGraphEdge.findFirst({
        where: { projectId, projectionKey: plan.projectionKey },
      });
    }
    throw error;
  }
}

export async function applyProjectGraphProjectionForEvent(
  db: ProjectGraphDbClient,
  event: ProjectGraphEventInput,
) {
  const plan = planProjectGraphProjectionFromEvent(event);
  const nodes = [];
  for (const nodePlan of plan.nodes) {
    nodes.push(await upsertNodeFromPlan(db, event.projectId, nodePlan));
  }
  const edges = [];
  for (const edgePlan of plan.edges) {
    const edge = await upsertEdgeFromPlan(db, event.projectId, edgePlan);
    if (edge) edges.push(edge);
  }
  return { nodes, edges, plan };
}

export async function applyProjectGraphProjectionForEvents(
  db: ProjectGraphDbClient,
  events: readonly ProjectGraphEventInput[],
) {
  const results = [];
  for (const event of events) {
    results.push(await applyProjectGraphProjectionForEvent(db, event));
  }
  return results;
}

function isRootPrismaClient(db: ProjectGraphDbClient): db is typeof prisma {
  return typeof (db as typeof prisma).$transaction === "function";
}

async function withGraphTransaction<T>(
  db: ProjectGraphDbClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (isRootPrismaClient(db)) {
    return db.$transaction((tx) => fn(tx));
  }
  return fn(db);
}

export async function clearProjectGraphProjection(db: ProjectGraphDbClient, projectId: string) {
  await db.projectGraphEdge.deleteMany({ where: { projectId } });
  await db.projectGraphNode.deleteMany({ where: { projectId } });
}

export async function rebuildProjectGraphProjection(projectId: string) {
  const pid = String(projectId ?? "").trim();
  if (!pid) throw new Error("projectId is required");

  return withGraphTransaction(prisma, async (tx) => {
    await clearProjectGraphProjection(tx, pid);
    const events = await tx.projectEvent.findMany({
      where: { projectId: pid },
      orderBy: { createdAt: "asc" },
      include: {
        projectMessage: { select: { content: true } },
      },
    });
    const inputs: ProjectGraphEventInput[] = events.map((e) => ({
      id: e.id,
      projectId: e.projectId,
      eventType: e.eventType,
      payload: e.payload,
      sourceMessageId: e.sourceMessageId,
      stage: e.stage,
      messageContent: e.projectMessage?.content ?? null,
    }));
    const results = await applyProjectGraphProjectionForEvents(tx, inputs);
    return { eventCount: events.length, appliedCount: results.length };
  });
}

export async function syncProjectGraphProjectionForProject(projectId: string) {
  const pid = String(projectId ?? "").trim();
  if (!pid) return { appliedCount: 0 };

  const events = await prisma.projectEvent.findMany({
    where: { projectId: pid },
    orderBy: { createdAt: "asc" },
    include: {
      projectMessage: { select: { content: true } },
    },
  });
  const inputs: ProjectGraphEventInput[] = events.map((e) => ({
    id: e.id,
    projectId: e.projectId,
    eventType: e.eventType,
    payload: e.payload,
    sourceMessageId: e.sourceMessageId,
    stage: e.stage,
    messageContent: e.projectMessage?.content ?? null,
  }));

  return withGraphTransaction(prisma, async (tx) => {
    const results = await applyProjectGraphProjectionForEvents(tx, inputs);
    return { appliedCount: results.length };
  });
}

export async function syncProjectGraphProjectionAfterEventIds(
  projectId: string,
  eventIds: readonly string[],
) {
  const pid = String(projectId ?? "").trim();
  const ids = eventIds.map((id) => String(id).trim()).filter(Boolean);
  if (!pid || ids.length === 0) return { appliedCount: 0 };

  const events = await prisma.projectEvent.findMany({
    where: { projectId: pid, id: { in: ids } },
    orderBy: { createdAt: "asc" },
    include: {
      projectMessage: { select: { content: true } },
    },
  });
  const inputs: ProjectGraphEventInput[] = events.map((e) => ({
    id: e.id,
    projectId: e.projectId,
    eventType: e.eventType,
    payload: e.payload,
    sourceMessageId: e.sourceMessageId,
    stage: e.stage,
    messageContent: e.projectMessage?.content ?? null,
  }));

  return withGraphTransaction(prisma, async (tx) => {
    const results = await applyProjectGraphProjectionForEvents(tx, inputs);
    return { appliedCount: results.length };
  });
}

/** Event Store 쓰기 후 비동기/베스트에포트 Graph projection (실패 시 로그만) */
export function trySyncProjectGraphProjection(projectId: string, eventIds?: readonly string[]) {
  const run = eventIds?.length
    ? syncProjectGraphProjectionAfterEventIds(projectId, eventIds)
    : syncProjectGraphProjectionForProject(projectId);
  void run.catch((error) => {
    console.error("Project Graph projection sync failed:", error);
  });
}
