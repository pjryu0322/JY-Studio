import { prisma } from "@/lib/prisma";
import { normalizeGraphSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import { parseKnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionSnapshot";

export async function backfillKnowledgeGraphRevisionSnapshotPurpose(
  projectId?: string,
  options?: Readonly<{
    readonly batchSize?: number;
    readonly maxBatches?: number;
    /** @deprecated use batchSize / maxBatches; cross-project scans only */
    readonly limit?: number;
  }>,
): Promise<{ readonly scanned: number; readonly updated: number }> {
  const batchSize = Math.min(500, Math.max(1, options?.batchSize ?? options?.limit ?? 200));
  const maxBatches = Math.min(500, Math.max(1, options?.maxBatches ?? 100));
  const pid = projectId?.trim();

  if (!pid) {
    const rows = await prisma.projectKnowledgeGraphRevision.findMany({
      orderBy: { revisionNumber: "desc" },
      take: batchSize,
      select: { id: true, graphSnapshot: true, snapshotPurpose: true },
    });
    let updated = 0;
    for (const row of rows) {
      const fromJson = normalizeGraphSnapshotPurpose(
        parseKnowledgeGraphRevisionSnapshot(row.graphSnapshot).purpose,
      );
      if (row.snapshotPurpose === fromJson) continue;
      await prisma.projectKnowledgeGraphRevision.update({
        where: { id: row.id },
        data: { snapshotPurpose: fromJson },
      });
      updated += 1;
    }
    return { scanned: rows.length, updated };
  }

  let cursorRevisionNumber: number | null = null;
  let scanned = 0;
  let updated = 0;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const rows = await prisma.projectKnowledgeGraphRevision.findMany({
      where: {
        projectId: pid,
        ...(cursorRevisionNumber != null ? { revisionNumber: { lt: cursorRevisionNumber } } : {}),
      },
      orderBy: { revisionNumber: "desc" },
      take: batchSize,
      select: {
        id: true,
        revisionNumber: true,
        graphSnapshot: true,
        snapshotPurpose: true,
      },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const fromJson = normalizeGraphSnapshotPurpose(
        parseKnowledgeGraphRevisionSnapshot(row.graphSnapshot).purpose,
      );
      if (row.snapshotPurpose === fromJson) continue;
      await prisma.projectKnowledgeGraphRevision.update({
        where: { id: row.id },
        data: { snapshotPurpose: fromJson },
      });
      updated += 1;
    }

    cursorRevisionNumber = rows[rows.length - 1]?.revisionNumber ?? null;
    if (rows.length < batchSize) break;
  }

  return { scanned, updated };
}
