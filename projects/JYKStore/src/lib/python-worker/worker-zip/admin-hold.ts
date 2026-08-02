import { PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS, WORKER_ZIP_REQUEST_TRIGGER } from "./constants";

/**
 * Admin has 접수'd the ZIP generation request, is running generation, or has
 * finished generation while the pack is still in the Admin DRAFT queue
 * (품질 점검 / 검수 승격 전). Provider must not edit during any of these.
 */
export type ProviderAdminGenerationHold = "ACCEPTED" | "PROCESSING" | "COMPLETED";

/** Latest open (PENDING|ACCEPTED) request marker for a pack, or null. */
export async function getLatestOpenRequestMarker(
  client: typeof prisma,
  packId: string,
): Promise<{ status: string; createdAt: Date } | null> {
  const marker = await client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
    },
    orderBy: { createdAt: "desc" },
    select: { status: true, createdAt: true },
  });
  return marker ? { status: marker.status, createdAt: marker.createdAt } : null;
}

/**
 * Resolve whether admin currently holds the pack after 접수.
 * - PROCESSING: generation running
 * - ACCEPTED: 접수완료, not yet finished
 * - COMPLETED: generation done, still DRAFT in admin queue (until PackReview or 반려)
 * REQUESTED / FAILED / REJECTED are not holds (provider may edit or re-submit).
 */
export async function resolveProviderAdminGenerationHold(
  packId: string,
  client: typeof prisma = prisma,
): Promise<ProviderAdminGenerationHold | null> {
  const trimmed = packId.trim();
  if (!trimmed) return null;

  const [processingRun, openMarker, completedMarker, draftPack] = await Promise.all([
    client.pipelineRun.findFirst({
      where: {
        packId: trimmed,
        triggerType: "WORKER_ZIP_IMPORT",
        status: "RUNNING",
      },
      select: { id: true },
    }),
    getLatestOpenRequestMarker(client, trimmed),
    client.pipelineRun.findFirst({
      where: {
        packId: trimmed,
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: "PASS",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
    client.knowledgePack.findFirst({
      where: { packId: trimmed, status: PackStatus.DRAFT },
      select: { packId: true },
    }),
  ]);

  if (processingRun) return "PROCESSING";
  if (openMarker?.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS) return "ACCEPTED";
  // Fresh REQUESTED (PENDING) — provider may still withdraw / replace materials.
  if (openMarker?.status === "PENDING") return null;
  // Generation complete, still DRAFT in admin queue (listAdminWorkerZipRequests).
  if (completedMarker && draftPack) return "COMPLETED";
  return null;
}

/** Batch hold resolution for provider pack list CTAs. */
export async function batchResolveProviderAdminGenerationHold(
  packIds: string[],
  client: typeof prisma = prisma,
): Promise<Map<string, ProviderAdminGenerationHold | null>> {
  const unique = [...new Set(packIds.map((id) => id.trim()).filter(Boolean))];
  const result = new Map<string, ProviderAdminGenerationHold | null>();
  for (const id of unique) result.set(id, null);
  if (unique.length === 0) return result;

  const [processingRuns, openMarkers, completedMarkers, draftPacks] = await Promise.all([
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: "WORKER_ZIP_IMPORT",
        status: "RUNNING",
      },
      select: { packId: true },
    }),
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
      },
      orderBy: { createdAt: "desc" },
      select: { packId: true, status: true, createdAt: true },
    }),
    client.pipelineRun.findMany({
      where: {
        packId: { in: unique },
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: "PASS",
      },
      orderBy: { createdAt: "desc" },
      select: { packId: true },
    }),
    client.knowledgePack.findMany({
      where: { packId: { in: unique }, status: PackStatus.DRAFT },
      select: { packId: true },
    }),
  ]);

  const processing = new Set(processingRuns.map((r) => r.packId));
  const draftSet = new Set(draftPacks.map((p) => p.packId));
  const latestOpen = new Map<string, { status: string }>();
  for (const m of openMarkers) {
    if (!latestOpen.has(m.packId)) latestOpen.set(m.packId, { status: m.status });
  }
  const hasCompleted = new Set<string>();
  for (const m of completedMarkers) {
    if (!hasCompleted.has(m.packId)) hasCompleted.add(m.packId);
  }

  for (const packId of unique) {
    if (processing.has(packId)) {
      result.set(packId, "PROCESSING");
      continue;
    }
    const open = latestOpen.get(packId);
    if (open?.status === WORKER_ZIP_REQUEST_ACCEPTED_STATUS) {
      result.set(packId, "ACCEPTED");
      continue;
    }
    if (open?.status === "PENDING") {
      result.set(packId, null);
      continue;
    }
    if (hasCompleted.has(packId) && draftSet.has(packId)) {
      result.set(packId, "COMPLETED");
      continue;
    }
    result.set(packId, null);
  }

  return result;
}

/** Coarse zip request status for list cards (marker + hold aligned). */
export function deriveListWorkerZipRequestStatus(input: {
  adminGenerationHold: ProviderAdminGenerationHold | null;
  hasPendingRequestMarker: boolean;
}):
  | "NONE"
  | "REQUESTED"
  | "ACCEPTED"
  | "PROCESSING"
  | "COMPLETED" {
  if (input.adminGenerationHold === "PROCESSING") return "PROCESSING";
  if (input.adminGenerationHold === "ACCEPTED") return "ACCEPTED";
  if (input.adminGenerationHold === "COMPLETED") return "COMPLETED";
  if (input.hasPendingRequestMarker) return "REQUESTED";
  return "NONE";
}
