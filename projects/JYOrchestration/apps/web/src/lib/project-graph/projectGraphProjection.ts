import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mergeGraphNodeMetadataWithReference } from "@/lib/project-knowledge/projectKnowledgeReferenceMetadata";
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

function savepointSqlName(key: string): string {
  const safe = String(key ?? "")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .slice(0, 48);
  return `kg_${safe || "sp"}`;
}

/** Postgres: unique 위반 후에도 동일 트랜잭션에서 후속 쿼리가 가능하도록 SAVEPOINT 사용 */
async function runWithSavepoint<T>(
  db: ProjectGraphDbClient,
  savepointKey: string,
  fn: () => Promise<T>,
): Promise<T> {
  const run = typeof (db as { $executeRawUnsafe?: unknown }).$executeRawUnsafe === "function";
  if (!run) {
    return fn();
  }
  const sp = savepointSqlName(savepointKey);
  await (db as Prisma.TransactionClient).$executeRawUnsafe(`SAVEPOINT "${sp}"`);
  try {
    return await fn();
  } catch (error) {
    await (db as Prisma.TransactionClient).$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${sp}"`);
    throw error;
  }
}

async function findNodeForPlan(
  db: ProjectGraphDbClient,
  projectId: string,
  plan: Pick<
    ReturnType<typeof planProjectGraphProjectionFromEvent>["nodes"][number],
    "projectionKey" | "entityKey"
  >,
) {
  return db.projectGraphNode.findFirst({
    where: {
      projectId,
      OR: [{ projectionKey: plan.projectionKey }, { entityKey: plan.entityKey }],
    },
  });
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
  const existing = await findNodeForPlan(db, projectId, plan);
  if (existing) return existing;

  try {
    const metadata = mergeGraphNodeMetadataWithReference(plan.metadata, {
      nodeType: plan.nodeType,
      title: plan.title,
      summary: plan.summary,
      projectionKey: plan.projectionKey,
      sourceEventId: plan.sourceEventId,
      lifecycleStatus: String(plan.metadata.structureCandidateLifecycle ?? plan.metadata.lifecycleStatus ?? ""),
      structureCandidateId: String(plan.metadata.structureCandidateId ?? "").trim() || null,
    });
    return await runWithSavepoint(db, plan.projectionKey, () =>
      db.projectGraphNode.create({
        data: {
          projectId,
          projectionKey: plan.projectionKey,
          entityKey: plan.entityKey,
          nodeType: plan.nodeType,
          title: plan.title,
          summary: plan.summary,
          metadata: metadata as Prisma.InputJsonValue,
          sourceEventId: plan.sourceEventId,
        },
      }),
    );
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      const row = await findNodeForPlan(db, projectId, plan);
      if (row) return row;
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
    return await runWithSavepoint(db, plan.projectionKey, () =>
      db.projectGraphEdge.create({
        data: {
          projectId,
          projectionKey: plan.projectionKey,
          fromNodeId,
          toNodeId,
          edgeType: plan.edgeType,
          metadata: plan.metadata as Prisma.InputJsonValue,
          sourceEventId: plan.sourceEventId,
        },
      }),
    );
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
