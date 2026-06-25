import { prisma } from "@/lib/prisma";
import { parseKnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionSnapshot";
import type {
  KnowledgeGraphRevisionDetail,
  KnowledgeGraphRevisionListItem,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

export function toKnowledgeGraphRevisionListItem(row: {
  id: string;
  revisionNumber: number;
  title: string;
  summary: string | null;
  nodeCount: number;
  edgeCount: number;
  createdAt: Date;
}): KnowledgeGraphRevisionListItem {
  return {
    id: row.id,
    revisionNumber: row.revisionNumber,
    title: row.title,
    summary: row.summary,
    nodeCount: row.nodeCount,
    edgeCount: row.edgeCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listKnowledgeGraphRevisions(
  projectId: string,
  options?: Readonly<{ readonly limit?: number }>,
): Promise<KnowledgeGraphRevisionListItem[]> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return [];

  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));

  const rows = await prisma.projectKnowledgeGraphRevision.findMany({
    where: { projectId: pid },
    orderBy: { revisionNumber: "asc" },
    take: limit,
    select: {
      id: true,
      revisionNumber: true,
      title: true,
      summary: true,
      nodeCount: true,
      edgeCount: true,
      createdAt: true,
    },
  });

  return rows.map(toKnowledgeGraphRevisionListItem);
}

export async function getLatestKnowledgeGraphRevision(
  projectId: string,
): Promise<KnowledgeGraphRevisionListItem | null> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return null;

  const row = await prisma.projectKnowledgeGraphRevision.findFirst({
    where: { projectId: pid },
    orderBy: { revisionNumber: "desc" },
    select: {
      id: true,
      revisionNumber: true,
      title: true,
      summary: true,
      nodeCount: true,
      edgeCount: true,
      createdAt: true,
    },
  });

  return row ? toKnowledgeGraphRevisionListItem(row) : null;
}

export async function loadLatestKnowledgeGraphRevision(
  projectId: string,
): Promise<KnowledgeGraphRevisionDetail | null> {
  const latest = await getLatestKnowledgeGraphRevision(projectId);
  if (!latest) return null;
  return loadKnowledgeGraphRevision(projectId, latest.id);
}

export async function loadKnowledgeGraphRevision(
  projectId: string,
  revisionId: string,
): Promise<KnowledgeGraphRevisionDetail | null> {
  const pid = String(projectId ?? "").trim();
  const rid = String(revisionId ?? "").trim();
  if (!pid || !rid) return null;

  const row = await prisma.projectKnowledgeGraphRevision.findFirst({
    where: { id: rid, projectId: pid },
  });
  if (!row) return null;

  return {
    ...toKnowledgeGraphRevisionListItem(row),
    graphSnapshot: parseKnowledgeGraphRevisionSnapshot(row.graphSnapshot),
  };
}
