/**
 * Internal operations helper only.
 * Not part of the default user reference flow.
 * Do not expose batch/materialize terminology in user-facing planning UX.
 */
import { prisma } from "@/lib/prisma";
import { PROJECT_LIFECYCLE_ACTIVE } from "@/lib/project/projectLifecycle";
import { isReferenceContextLegacyMissing } from "@/lib/project-knowledge/projectKnowledgeReferencePlanningActions";
import {
  materializeReferenceContextForProject,
  type MaterializeReferenceContextResult,
} from "@/lib/project-knowledge/projectKnowledgeReferenceMaterializationService";
import { parseRequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export const MATERIALIZE_MISSING_DEFAULT_LIMIT = 50;
export const MATERIALIZE_MISSING_MAX_LIMIT = 200;
const MAX_SCAN_POOL = 500;

export type MaterializeMissingBatchResultItem = Readonly<{
  readonly projectId: string;
  readonly status:
    | "MATERIALIZED"
    | "ALREADY_MATERIALIZED"
    | "NO_REFERENCE_SELECTION"
    | "SOURCE_UNAVAILABLE"
    | "SOURCE_PERMISSION_DENIED"
    | "SNAPSHOT_NOT_READY"
    | "INVALID_SELECTION";
  readonly referenceContextSource: "MATERIALIZED" | "NONE" | "LEGACY_MISSING";
  readonly message?: string;
}>;

export type MaterializeMissingBatchResult = Readonly<{
  readonly dryRun: boolean;
  readonly scanned: number;
  readonly legacyMissing: number;
  readonly materialized: number;
  readonly alreadyMaterialized: number;
  readonly noReferenceSelection: number;
  readonly failed: number;
  readonly results: readonly MaterializeMissingBatchResultItem[];
}>;

export function clampMaterializeMissingLimit(raw: unknown): number {
  const n =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.floor(raw)
      : MATERIALIZE_MISSING_DEFAULT_LIMIT;
  return Math.min(MATERIALIZE_MISSING_MAX_LIMIT, Math.max(1, n));
}

function toBatchItem(result: MaterializeReferenceContextResult): MaterializeMissingBatchResultItem {
  if (result.status === "MATERIALIZED" || result.status === "ALREADY_MATERIALIZED") {
    return {
      projectId: result.projectId,
      status: result.status,
      referenceContextSource: result.referenceContextSource,
    };
  }
  if (result.status === "NO_REFERENCE_SELECTION") {
    return {
      projectId: result.projectId,
      status: result.status,
      referenceContextSource: result.referenceContextSource,
    };
  }
  return {
    projectId: result.projectId,
    status: result.status,
    referenceContextSource: result.referenceContextSource,
    message: result.message,
  };
}

function bumpAggregate(
  tallies: {
    materialized: number;
    alreadyMaterialized: number;
    noReferenceSelection: number;
    failed: number;
  },
  item: MaterializeMissingBatchResultItem,
): void {
  switch (item.status) {
    case "MATERIALIZED":
      tallies.materialized += 1;
      break;
    case "ALREADY_MATERIALIZED":
      tallies.alreadyMaterialized += 1;
      break;
    case "NO_REFERENCE_SELECTION":
      tallies.noReferenceSelection += 1;
      break;
    default:
      tallies.failed += 1;
      break;
  }
}

async function loadProjectsForBatchScan(input: Readonly<{
  readonly userId: string;
  readonly scanAsPlatformAdmin: boolean;
  readonly poolSize: number;
}>): Promise<ReadonlyArray<{ readonly id: string; readonly requirementsStateJson: unknown }>> {
  const take = Math.min(MAX_SCAN_POOL, Math.max(input.poolSize, 1));
  if (input.scanAsPlatformAdmin) {
    return prisma.project.findMany({
      where: { status: PROJECT_LIFECYCLE_ACTIVE },
      select: { id: true, requirementsStateJson: true },
      orderBy: { updatedAt: "desc" },
      take,
    });
  }
  return prisma.project.findMany({
    where: {
      status: PROJECT_LIFECYCLE_ACTIVE,
      OR: [
        { ownerUserId: input.userId },
        {
          members: {
            some: {
              userId: input.userId,
              memberType: "HUMAN",
            },
          },
        },
      ],
    },
    select: { id: true, requirementsStateJson: true },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export async function materializeMissingReferenceContextsBatch(input: Readonly<{
  readonly userId: string;
  readonly dryRun?: boolean;
  readonly limit?: number;
  readonly scanAsPlatformAdmin?: boolean;
}>): Promise<MaterializeMissingBatchResult> {
  const userId = String(input.userId ?? "").trim();
  const dryRun = input.dryRun === true;
  const limit = clampMaterializeMissingLimit(input.limit);
  const scanAsPlatformAdmin = input.scanAsPlatformAdmin === true;

  const pool = await loadProjectsForBatchScan({
    userId,
    scanAsPlatformAdmin,
    poolSize: limit * 4,
  });

  let scanned = 0;
  let legacyMissing = 0;
  const legacyProjectIds: string[] = [];

  for (const row of pool) {
    scanned += 1;
    const state = parseRequirementsStateJson(row.requirementsStateJson);
    if (!isReferenceContextLegacyMissing(state)) continue;
    legacyMissing += 1;
    legacyProjectIds.push(row.id);
    if (legacyProjectIds.length >= limit) break;
  }

  const tallies = {
    materialized: 0,
    alreadyMaterialized: 0,
    noReferenceSelection: 0,
    failed: 0,
  };
  const results: MaterializeMissingBatchResultItem[] = [];

  for (const projectId of legacyProjectIds) {
    try {
      const result = await materializeReferenceContextForProject({
        projectId,
        userId,
        dryRun,
      });
      const item = toBatchItem(result);
      results.push(item);
      bumpAggregate(tallies, item);
    } catch {
      const item: MaterializeMissingBatchResultItem = {
        projectId,
        status: "INVALID_SELECTION",
        referenceContextSource: "LEGACY_MISSING",
        message: "처리 중 오류가 발생했습니다.",
      };
      results.push(item);
      tallies.failed += 1;
    }
  }

  return {
    dryRun,
    scanned,
    legacyMissing,
    materialized: tallies.materialized,
    alreadyMaterialized: tallies.alreadyMaterialized,
    noReferenceSelection: tallies.noReferenceSelection,
    failed: tallies.failed,
    results,
  };
}
