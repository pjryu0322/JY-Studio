/* ------------------------------------------------------------------ *
 * P7.3: Admin 접수함 — DRAFT packs with a pending generation request.
 * ------------------------------------------------------------------ */
import { prisma } from "@/lib/prisma";
import { getWorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";
import { batchResolveStoreWorkflowMarkers } from "@/lib/store-workflow-markers";
import {
  appendRecoveredCompletedImportItems,
  assembleWorkerZipInboxItems,
  buildDraftItemsFromOpenRuns,
  loadQualityStatusMaps,
} from "./assemble-worker-zip-inbox-item";
import {
  queryCompletedWorkerZipImportRuns,
  queryLegacyWorkerZipRequestRuns,
  queryOpenWorkerZipRequestRuns,
} from "./query-worker-zip-requests";
import type {
  AdminWorkerZipRequestListItem,
  ListAdminWorkerZipRequestsInput,
} from "./types";

export type { AdminWorkerZipRequestListItem } from "./types";

/**
 * List DRAFT packs with an open or completed ZIP generation request, newest
 * first, deduped by pack. Includes retired (PASS) markers so generation-complete
 * packs remain reachable until they leave DRAFT / enter REVIEWING.
 */
export async function listAdminWorkerZipRequests(
  input?: ListAdminWorkerZipRequestsInput,
): Promise<AdminWorkerZipRequestListItem[]> {
  const client = input?.prismaClient ?? prisma;
  const getRequestMetadata = input?.getRequestMetadata ?? getWorkerZipRequestMetadata;

  const runs = await queryOpenWorkerZipRequestRuns(client);
  const { draftItems, seen } = await buildDraftItemsFromOpenRuns({
    runs,
    env: input?.env,
    getRequestMetadata,
  });

  // Recover DRAFT packs whose request markers were retired (SKIPPED/withdrawn)
  // after Admin already ran Worker ZIP import successfully.
  const completedImports = await queryCompletedWorkerZipImportRuns(client, [...seen]);
  const recoveredCandidates = completedImports.filter((run) => !seen.has(run.packId));
  const recoveredPackIds = recoveredCandidates.map((run) => run.packId);
  const legacyRequests =
    recoveredPackIds.length > 0
      ? await queryLegacyWorkerZipRequestRuns(client, recoveredPackIds)
      : [];

  await appendRecoveredCompletedImportItems({
    draftItems,
    seen,
    completedImports,
    legacyRequests,
    env: input?.env,
    getRequestMetadata,
  });

  const packIds = draftItems.map((item) => item.packId);
  const { qualityCheckedAtByPack, qualityStatusByPack } = await loadQualityStatusMaps(
    client,
    packIds,
  );

  const markersByPack = input?.resolveWorkflowMarkers
    ? await input.resolveWorkflowMarkers(packIds)
    : input?.prismaClient
      ? new Map()
      : await batchResolveStoreWorkflowMarkers(packIds, client);

  return assembleWorkerZipInboxItems({
    draftItems,
    markersByPack,
    qualityCheckedAtByPack,
    qualityStatusByPack,
  });
}
