import { prisma } from "@/lib/prisma";
import {
  loadKnowledgeGraphRevision,
  toKnowledgeGraphRevisionListItem,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionQuery";
import type {
  KnowledgeGraphRevisionDetail,
  KnowledgeGraphRevisionListItem,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

const REFERENCE_SNAPSHOT_PURPOSES = ["REFERENCE_CANDIDATE", "REFERENCE_PACKAGE"] as const;

export async function getLatestReferenceKnowledgeGraphRevision(
  projectId: string,
): Promise<KnowledgeGraphRevisionListItem | null> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return null;

  const row = await prisma.projectKnowledgeGraphRevision.findFirst({
    where: {
      projectId: pid,
      snapshotPurpose: { in: [...REFERENCE_SNAPSHOT_PURPOSES] },
    },
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

export async function loadLatestReferenceKnowledgeGraphRevision(
  projectId: string,
): Promise<KnowledgeGraphRevisionDetail | null> {
  const latest = await getLatestReferenceKnowledgeGraphRevision(projectId);
  if (!latest) return null;
  return loadKnowledgeGraphRevision(projectId, latest.id);
}
