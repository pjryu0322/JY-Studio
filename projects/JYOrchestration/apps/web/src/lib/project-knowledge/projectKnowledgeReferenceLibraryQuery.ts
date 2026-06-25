import { prisma } from "@/lib/prisma";
import { listProjectsAccessibleToUser } from "@/lib/service/projectService";
import { parseKnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionSnapshot";
import { computeReferenceEligibility } from "@/lib/project-knowledge/projectKnowledgeReferenceEligibilityService";
import type {
  ReferenceLibraryItem,
  ReferenceLibraryReadiness,
  ReferenceLibrarySnapshotPurpose,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import { buildReferenceEligibilityMetricsFromSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceSnapshotEligibility";
import { buildReusableAssetsFromReferenceSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceSnapshotAssets";
import { normalizeGraphSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import { PROJECT_LIFECYCLE_ACTIVE } from "@/lib/project/projectLifecycle";

const REFERENCE_PURPOSES = ["REFERENCE_CANDIDATE", "REFERENCE_PACKAGE"] as const;

function readinessFromPurpose(purpose: ReferenceLibrarySnapshotPurpose): ReferenceLibraryReadiness {
  return purpose === "REFERENCE_PACKAGE" ? "VERIFIED" : "READY";
}

function matchesQuery(item: ReferenceLibraryItem, q: string): boolean {
  if (!q) return true;
  const hay = [
    item.projectTitle,
    item.projectDescription ?? "",
    item.snapshotTitle,
    ...item.reusableAssets.actors,
    ...item.reusableAssets.serviceFlows,
    ...item.reusableAssets.features,
    ...item.reusableAssets.decisions,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function buildItemFromRow(row: {
  id: string;
  title: string;
  snapshotPurpose: string;
  graphSnapshot: unknown;
  createdAt: Date;
  projectId: string;
  project: { name: string; description: string | null; updatedAt: Date };
}): ReferenceLibraryItem | null {
  const purpose = normalizeGraphSnapshotPurpose(row.snapshotPurpose);
  if (purpose !== "REFERENCE_CANDIDATE" && purpose !== "REFERENCE_PACKAGE") return null;

  const snapshot = parseKnowledgeGraphRevisionSnapshot(row.graphSnapshot);
  const metrics = buildReferenceEligibilityMetricsFromSnapshot(snapshot);
  const flags =
    purpose === "REFERENCE_PACKAGE"
      ? { hasReferencePackageSnapshot: true, hasReferenceCandidateSnapshot: false }
      : { hasReferenceCandidateSnapshot: true, hasReferencePackageSnapshot: false };
  const eligibility = computeReferenceEligibility(metrics, flags);
  if (eligibility.level !== "SNAPSHOT_READY" && eligibility.level !== "VERIFIED") return null;

  const reusableAssets = buildReusableAssetsFromReferenceSnapshot(snapshot);
  const typedPurpose = purpose as ReferenceLibrarySnapshotPurpose;

  return {
    projectId: row.projectId,
    projectTitle: row.project.name,
    projectDescription: row.project.description,
    referenceSnapshotId: row.id,
    snapshotTitle: row.title,
    snapshotPurpose: typedPurpose,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.project.updatedAt.toISOString(),
    readiness: readinessFromPurpose(typedPurpose),
    reusableAssets,
    counts: {
      actors: reusableAssets.actors.length,
      serviceFlows: reusableAssets.serviceFlows.length,
      features: reusableAssets.features.length,
      reusableGraphNodes: eligibility.counts.reusableGraphNodes,
    },
  };
}

export async function listReferenceLibraryItems(input: Readonly<{
  readonly userId: string;
  readonly q?: string;
  readonly purpose?: "all" | "candidate" | "package";
  readonly sort?: "recent" | "name";
  readonly limit?: number;
}>): Promise<ReferenceLibraryItem[]> {
  const userId = String(input.userId ?? "").trim();
  if (!userId) return [];

  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const q = String(input.q ?? "").trim().toLowerCase();
  const purposeFilter = input.purpose ?? "all";
  const sort = input.sort ?? "recent";

  const accessible = await listProjectsAccessibleToUser(userId, { includeDeleted: false });
  const projectIds = accessible.filter((p) => p.status === PROJECT_LIFECYCLE_ACTIVE).map((p) => p.id);
  if (projectIds.length === 0) return [];

  const revisions = await prisma.projectKnowledgeGraphRevision.findMany({
    where: {
      projectId: { in: projectIds },
      snapshotPurpose: { in: [...REFERENCE_PURPOSES] },
    },
    orderBy: [{ projectId: "asc" }, { revisionNumber: "desc" }],
    select: {
      id: true,
      title: true,
      snapshotPurpose: true,
      graphSnapshot: true,
      createdAt: true,
      projectId: true,
      revisionNumber: true,
      project: { select: { name: true, description: true, updatedAt: true } },
    },
  });

  const seenProject = new Set<string>();
  const items: ReferenceLibraryItem[] = [];

  for (const row of revisions) {
    if (seenProject.has(row.projectId)) continue;
    seenProject.add(row.projectId);

    const item = buildItemFromRow(row);
    if (!item) continue;

    if (purposeFilter === "candidate" && item.snapshotPurpose !== "REFERENCE_CANDIDATE") continue;
    if (purposeFilter === "package" && item.snapshotPurpose !== "REFERENCE_PACKAGE") continue;
    if (!matchesQuery(item, q)) continue;

    items.push(item);
  }

  items.sort((a, b) => {
    if (sort === "name") {
      return a.projectTitle.localeCompare(b.projectTitle, "ko");
    }
    return b.createdAt.localeCompare(a.createdAt);
  });

  return items.slice(0, limit);
}
