import { backfillKnowledgeGraphRevisionSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionBackfillService";
import { backfillProjectGraphNodeReferenceMetadata } from "@/lib/project-knowledge/projectKnowledgeReferenceGraphNodeBackfillService";

export { ensureProjectReferenceMetadataReady } from "@/lib/project-knowledge/projectKnowledgeReferenceEnsureService";
export { backfillProjectGraphNodeReferenceMetadata } from "@/lib/project-knowledge/projectKnowledgeReferenceGraphNodeBackfillService";

export async function runProjectReferenceBackfill(projectId: string): Promise<{
  readonly graphNodes: { scanned: number; updated: number };
  readonly revisions: { scanned: number; updated: number };
}> {
  const pid = String(projectId ?? "").trim();
  const graphNodes = await backfillProjectGraphNodeReferenceMetadata(pid, { limitNodes: 500 });
  const revisions = await backfillKnowledgeGraphRevisionSnapshotPurpose(pid);
  return { graphNodes, revisions };
}
