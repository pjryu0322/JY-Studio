import { backfillKnowledgeGraphRevisionSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionBackfillService";
import { backfillProjectGraphNodeReferenceMetadata } from "@/lib/project-knowledge/projectKnowledgeReferenceGraphNodeBackfillService";
import { parseProjectGraphNodeReferenceMetadata } from "@/lib/project-knowledge/projectKnowledgeReferenceMetadata";
import { prisma } from "@/lib/prisma";

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
