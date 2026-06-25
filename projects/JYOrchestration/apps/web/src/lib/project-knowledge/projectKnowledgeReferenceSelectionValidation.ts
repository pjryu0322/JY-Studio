import { prisma } from "@/lib/prisma";
import { requireProjectPermission } from "@/lib/auth/rbacGuard";
import { ProjectAccessDeniedError } from "@/lib/rbac/projectAccessDenied";
import { parseKnowledgeGraphRevisionSnapshot } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionSnapshot";
import { computeReferenceEligibility } from "@/lib/project-knowledge/projectKnowledgeReferenceEligibilityService";
import type {
  ProjectReferenceSelectionSummaryV1,
  ProjectReferenceSelectionV1,
  ReferenceLibraryReadiness,
  ReferenceLibrarySnapshotPurpose,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import { buildReferenceEligibilityMetricsFromSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceSnapshotEligibility";
import { normalizeGraphSnapshotPurpose } from "@/lib/project-knowledge/projectKnowledgeReferenceNormalize";
import { buildMaterializedReferenceContextFromSnapshot } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import type { MaterializedReferenceContextV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import { PROJECT_LIFECYCLE_ACTIVE } from "@/lib/project/projectLifecycle";

const ALLOWED_SNAPSHOT_PURPOSES = new Set<ReferenceLibrarySnapshotPurpose>([
  "REFERENCE_CANDIDATE",
  "REFERENCE_PACKAGE",
]);

export class ReferenceSnapshotSelectionValidationError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ReferenceSnapshotSelectionValidationError";
    this.status = status;
  }
}

export function normalizeReferenceSnapshotIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((id) => String(id ?? "").trim()).filter(Boolean))];
}

export function assertMvpReferenceSnapshotIdCount(ids: readonly string[]): void {
  if (ids.length > 1) {
    throw new ReferenceSnapshotSelectionValidationError(
      "참조 저장본은 한 번에 하나만 선택할 수 있습니다.",
      400,
    );
  }
}

export async function validateReferenceSnapshotSelectionForUser(input: Readonly<{
  readonly userId: string;
  readonly referenceSnapshotIds: readonly string[];
}>): Promise<Readonly<{
  readonly selection: ProjectReferenceSelectionV1;
  readonly summary: ProjectReferenceSelectionSummaryV1;
  readonly materializedReferenceContextV1: MaterializedReferenceContextV1;
}>> {
  const userId = String(input.userId ?? "").trim();
  const ids = normalizeReferenceSnapshotIds(input.referenceSnapshotIds);
  if (ids.length === 0) {
    throw new ReferenceSnapshotSelectionValidationError("참조 저장본을 선택해 주세요.", 400);
  }
  assertMvpReferenceSnapshotIdCount(ids);

  const snapshotId = ids[0]!;
  const revision = await prisma.projectKnowledgeGraphRevision.findUnique({
    where: { id: snapshotId },
    select: {
      id: true,
      title: true,
      snapshotPurpose: true,
      graphSnapshot: true,
      projectId: true,
      project: { select: { id: true, name: true, status: true } },
    },
  });

  if (!revision?.project || revision.project.status !== PROJECT_LIFECYCLE_ACTIVE) {
    throw new ReferenceSnapshotSelectionValidationError("선택한 참조 저장본을 사용할 수 없습니다.", 404);
  }

  const purpose = normalizeGraphSnapshotPurpose(revision.snapshotPurpose) as string;
  if (!ALLOWED_SNAPSHOT_PURPOSES.has(purpose as ReferenceLibrarySnapshotPurpose)) {
    throw new ReferenceSnapshotSelectionValidationError("참조용 저장본만 선택할 수 있습니다.", 400);
  }

  try {
    await requireProjectPermission(revision.projectId, userId, "canViewProject", "reference snapshot selection");
  } catch (error) {
    if (error instanceof ProjectAccessDeniedError) {
      throw new ReferenceSnapshotSelectionValidationError("선택한 참조 프로젝트에 접근할 수 없습니다.", 403);
    }
    throw error;
  }

  const snapshot = parseKnowledgeGraphRevisionSnapshot(revision.graphSnapshot);
  const metrics = buildReferenceEligibilityMetricsFromSnapshot(snapshot);
  const flags =
    purpose === "REFERENCE_PACKAGE"
      ? { hasReferencePackageSnapshot: true, hasReferenceCandidateSnapshot: false }
      : { hasReferenceCandidateSnapshot: true, hasReferencePackageSnapshot: false };
  const eligibility = computeReferenceEligibility(metrics, flags);
  if (eligibility.level !== "SNAPSHOT_READY" && eligibility.level !== "VERIFIED") {
    throw new ReferenceSnapshotSelectionValidationError("참조 저장본이 아직 준비되지 않았습니다.", 400);
  }

  const readiness: ReferenceLibraryReadiness = purpose === "REFERENCE_PACKAGE" ? "VERIFIED" : "READY";
  const typedPurpose = purpose as ReferenceLibrarySnapshotPurpose;

  const materializedReferenceContextV1 = buildMaterializedReferenceContextFromSnapshot({
    sourceProjectTitle: revision.project.name,
    snapshotTitle: revision.title,
    snapshotPurpose: typedPurpose,
    sourceSnapshotId: revision.id,
    graphSnapshot: snapshot,
  });

  return {
    selection: {
      referenceSnapshotIds: [revision.id],
      selectedAt: new Date().toISOString(),
      source: "USER_SELECTED",
    },
    summary: {
      sourceProjectTitle: revision.project.name,
      snapshotTitle: revision.title,
      readiness,
      actorCount: materializedReferenceContextV1.summary.actorCount,
      serviceFlowCount: materializedReferenceContextV1.summary.serviceFlowCount,
      featureCount: materializedReferenceContextV1.summary.featureCount,
      graphReusableNodeCount: materializedReferenceContextV1.summary.graphReusableNodeCount,
    },
    materializedReferenceContextV1,
  };
}
