import { prisma } from "@/lib/prisma";
import type { ProjectReferenceSelectionSummaryV1 } from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import {
  parseProjectReferenceSelectionSummaryV1,
  parseProjectReferenceSelectionV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceLibraryTypes";
import {
  parseMaterializedReferenceContextV1,
  type MaterializedReferenceContextV1,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializedContext";
import {
  normalizeReferenceSnapshotIds,
  ReferenceSnapshotSelectionValidationError,
  prepareReferenceSnapshotSelectionForUser,
} from "@/lib/project-knowledge/projectKnowledgeReferenceSelectionValidation";
import { mergeRequirementsStateJson, parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";
import { requireProjectPermissionById } from "@/lib/service/taskOwnershipGuard";
import type { Prisma } from "@prisma/client";

export type MaterializeReferenceContextResult =
  | {
      readonly status: "MATERIALIZED";
      readonly projectId: string;
      readonly referenceContextSource: "MATERIALIZED";
      readonly summary: ProjectReferenceSelectionSummaryV1;
      readonly counts: {
        readonly actorCount: number;
        readonly serviceFlowCount: number;
        readonly featureCount: number;
        readonly graphReusableNodeCount: number;
      };
    }
  | {
      readonly status: "ALREADY_MATERIALIZED";
      readonly projectId: string;
      readonly referenceContextSource: "MATERIALIZED";
      readonly summary: ProjectReferenceSelectionSummaryV1 | null;
    }
  | {
      readonly status: "NO_REFERENCE_SELECTION";
      readonly projectId: string;
      readonly referenceContextSource: "NONE";
    }
  | {
      readonly status:
        | "SOURCE_UNAVAILABLE"
        | "SOURCE_PERMISSION_DENIED"
        | "SNAPSHOT_NOT_READY"
        | "INVALID_SELECTION";
      readonly projectId: string;
      readonly referenceContextSource: "LEGACY_MISSING";
      readonly message: string;
    };

export class MaterializeReferenceContextProjectNotFoundError extends Error {
  constructor() {
    super("project not found");
    this.name = "MaterializeReferenceContextProjectNotFoundError";
  }
}

function summaryFromMaterialized(
  materialized: MaterializedReferenceContextV1,
): ProjectReferenceSelectionSummaryV1 {
  const readiness =
    materialized.source.snapshotPurpose === "REFERENCE_PACKAGE" ? "VERIFIED" : "READY";
  return {
    sourceProjectTitle: materialized.source.sourceProjectTitle,
    snapshotTitle: materialized.source.snapshotTitle,
    readiness,
    actorCount: materialized.summary.actorCount,
    serviceFlowCount: materialized.summary.serviceFlowCount,
    featureCount: materialized.summary.featureCount,
    graphReusableNodeCount: materialized.summary.graphReusableNodeCount,
  };
}

function mapValidationError(
  projectId: string,
  error: ReferenceSnapshotSelectionValidationError,
): Extract<MaterializeReferenceContextResult, { readonly message: string }> {
  if (error.status === 403) {
    return {
      status: "SOURCE_PERMISSION_DENIED",
      projectId,
      referenceContextSource: "LEGACY_MISSING",
      message: "선택한 참조 프로젝트에 접근할 수 없습니다.",
    };
  }
  if (error.status === 404) {
    return {
      status: "SOURCE_UNAVAILABLE",
      projectId,
      referenceContextSource: "LEGACY_MISSING",
      message: "참조 저장본을 다시 확인할 수 없습니다. 참조를 해제해 주세요.",
    };
  }
  if (error.message.includes("준비되지")) {
    return {
      status: "SNAPSHOT_NOT_READY",
      projectId,
      referenceContextSource: "LEGACY_MISSING",
      message: "참조 저장본이 아직 준비되지 않았습니다.",
    };
  }
  return {
    status: "INVALID_SELECTION",
    projectId,
    referenceContextSource: "LEGACY_MISSING",
    message: error.message || "참조 저장본 선택을 확인할 수 없습니다.",
  };
}

/**
 * Legacy `referenceSelectionV1`만 있는 target project(B)에
 * AI 프롬프트용 `materializedReferenceContextV1`를 준비한다.
 *
 * Graph Snapshot은 source project(A)의 특정 시점 불변 고정본이며 읽기 전용으로만 사용한다.
 * source project, source working graph, source graph snapshot, source revision은 update하지 않는다.
 * update 대상은 target project `requirementsStateJson`뿐이다.
 */
export async function materializeReferenceContextForProject(input: Readonly<{
  readonly projectId: string;
  readonly userId: string;
  readonly dryRun?: boolean;
}>): Promise<MaterializeReferenceContextResult> {
  const projectId = String(input.projectId ?? "").trim();
  const userId = String(input.userId ?? "").trim();
  if (!projectId || !userId) {
    throw new ReferenceSnapshotSelectionValidationError("요청 정보가 올바르지 않습니다.", 400);
  }

  await requireProjectPermissionById(projectId, userId, "canEditProject", "materialize reference context");

  const row = await prisma.project.findUnique({
    where: { id: projectId },
    select: { requirementsStateJson: true },
  });
  if (!row) {
    throw new MaterializeReferenceContextProjectNotFoundError();
  }

  const state = parseRequirementsStateJson(row.requirementsStateJson);
  const existingMaterialized = parseMaterializedReferenceContextV1(state.materializedReferenceContextV1);
  if (existingMaterialized) {
    const summary =
      parseProjectReferenceSelectionSummaryV1(state.referenceSelectionSummaryV1) ??
      summaryFromMaterialized(existingMaterialized);
    return {
      status: "ALREADY_MATERIALIZED",
      projectId,
      referenceContextSource: "MATERIALIZED",
      summary,
    };
  }

  const selection = parseProjectReferenceSelectionV1(state.referenceSelectionV1);
  if (!selection) {
    return {
      status: "NO_REFERENCE_SELECTION",
      projectId,
      referenceContextSource: "NONE",
    };
  }

  const ids = normalizeReferenceSnapshotIds(selection.referenceSnapshotIds);
  if (ids.length > 1) {
    return {
      status: "INVALID_SELECTION",
      projectId,
      referenceContextSource: "LEGACY_MISSING",
      message: "참조 저장본은 한 번에 하나만 선택할 수 있습니다.",
    };
  }
  if (ids.length === 0) {
    return {
      status: "INVALID_SELECTION",
      projectId,
      referenceContextSource: "LEGACY_MISSING",
      message: "참조 저장본을 선택해 주세요.",
    };
  }

  try {
    const validated = await prepareReferenceSnapshotSelectionForUser({
      userId,
      referenceSnapshotIds: ids,
    });

    if (!input.dryRun) {
      const next = mergeRequirementsStateJson(state, {
        referenceSelectionV1: validated.selection,
        referenceSelectionSummaryV1: validated.summary,
        materializedReferenceContextV1: validated.materializedReferenceContextV1,
      });
      await prisma.project.update({
        where: { id: projectId },
        data: { requirementsStateJson: next as Prisma.InputJsonValue },
      });
    }

    return {
      status: "MATERIALIZED",
      projectId,
      referenceContextSource: "MATERIALIZED",
      summary: validated.summary,
      counts: {
        actorCount: validated.summary.actorCount,
        serviceFlowCount: validated.summary.serviceFlowCount,
        featureCount: validated.summary.featureCount,
        graphReusableNodeCount: validated.summary.graphReusableNodeCount,
      },
    };
  } catch (error) {
    if (error instanceof ReferenceSnapshotSelectionValidationError) {
      return mapValidationError(projectId, error);
    }
    throw error;
  }
}
