import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { backfillKnowledgeGraphRevisionSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionService";
import {
  mergeGraphNodeMetadataWithReference,
  parseProjectGraphNodeReferenceMetadata,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMetadata";

function readMetaString(metadata: unknown, key: string): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  return String((metadata as Record<string, unknown>)[key] ?? "").trim();
}

function metadataRecord(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return { ...(metadata as Record<string, unknown>) };
}

export async function backfillProjectGraphNodeReferenceMetadata(
  projectId: string,
  options?: Readonly<{ readonly limitNodes?: number }>,
): Promise<{ readonly scanned: number; readonly updated: number }> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return { scanned: 0, updated: 0 };

  const limit = Math.min(2000, Math.max(1, options?.limitNodes ?? 500));
  const nodes = await prisma.projectGraphNode.findMany({
    where: { projectId: pid },
    take: limit,
    select: {
      id: true,
      nodeType: true,
      title: true,
      summary: true,
      projectionKey: true,
      sourceEventId: true,
      metadata: true,
    },
  });

  const candidateIds = [
    ...new Set(
      nodes
        .map((n) => readMetaString(n.metadata, "structureCandidateId"))
        .filter(Boolean),
    ),
  ];

  const candidates =
    candidateIds.length === 0
      ? []
      : await prisma.projectStructureCandidate.findMany({
          where: { projectId: pid, id: { in: candidateIds } },
          select: { id: true, lifecycleStatus: true },
        });
  const lifecycleByCandidateId = new Map(candidates.map((c) => [c.id, c.lifecycleStatus]));

  let updated = 0;
  for (const node of nodes) {
    if (parseProjectGraphNodeReferenceMetadata(node.metadata)) continue;

    const structureCandidateId = readMetaString(node.metadata, "structureCandidateId");
    let lifecycleStatus: string | undefined;
    if (structureCandidateId) {
      lifecycleStatus = lifecycleByCandidateId.get(structureCandidateId);
    } else if (String(node.projectionKey ?? "").startsWith("approved-candidate:")) {
      lifecycleStatus = "APPROVED";
    }

    const nextMetadata = mergeGraphNodeMetadataWithReference(metadataRecord(node.metadata), {
      nodeType: node.nodeType,
      title: node.title,
      summary: node.summary,
      projectionKey: node.projectionKey,
      sourceEventId: node.sourceEventId,
      lifecycleStatus,
      structureCandidateId: structureCandidateId || null,
    });

    await prisma.projectGraphNode.update({
      where: { id: node.id },
      data: { metadata: nextMetadata as Prisma.InputJsonValue },
    });
    updated += 1;
  }

  return { scanned: nodes.length, updated };
}

export async function ensureProjectReferenceMetadataReady(projectId: string): Promise<void> {
  const pid = String(projectId ?? "").trim();
  if (!pid) return;

  const sample = await prisma.projectGraphNode.findMany({
    where: { projectId: pid },
    take: 40,
    select: { metadata: true },
  });

  const needsNodeBackfill = sample.some((n) => !parseProjectGraphNodeReferenceMetadata(n.metadata));
  if (needsNodeBackfill) {
    await backfillProjectGraphNodeReferenceMetadata(pid, { limitNodes: 500 });
  }

  await backfillKnowledgeGraphRevisionSnapshotPurpose(pid);
}

export async function runProjectReferenceBackfill(projectId: string): Promise<{
  readonly graphNodes: { scanned: number; updated: number };
  readonly revisions: { scanned: number; updated: number };
}> {
  const pid = String(projectId ?? "").trim();
  const graphNodes = await backfillProjectGraphNodeReferenceMetadata(pid, { limitNodes: 500 });
  const revisions = await backfillKnowledgeGraphRevisionSnapshotPurpose(pid);
  return { graphNodes, revisions };
}
