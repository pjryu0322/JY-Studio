import { prisma } from "@/lib/prisma";
import { getWorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";
import type { ProviderWorkerZipImportResult } from "../import-run";
import { runProviderWorkerZipImport } from "../import-run";
import { resolveAdminDraftPack } from "../pack-resolvers";
import {
  executeTestOverrideGeneration,
  executeWorkingCopyWorkerRun,
} from "./execute-worker-run";
import { failGenerationOnImportError } from "./fail-generation";
import { finalizeSuccessfulGeneration } from "./finalize-generation";
import {
  assertNotAlreadyRunning,
  findOpenRequestMarker,
  loadAndVerifyWorkingCopy,
  lockRequestMarkerOnExecute,
  prepareInventoryForGeneration,
  resolveGenerationSourceRevision,
} from "./prepare-admin-generation";
import type { RunAdminWorkerZipGenerationInput } from "./types";

/**
 * Execute the ZIP Worker for an Admin-received request. The Admin route is gated
 * by `requireAdminSession`; this function is the only place Worker execution is
 * driven for the ZIP path. It binds the request marker's source revision, creates
 * a Working Copy (copy + frozen exclusions), streams the copy to a temp file, and
 * runs the pipeline against the DRAFT pack.
 */
export async function runAdminWorkerZipGeneration(
  input: RunAdminWorkerZipGenerationInput,
): Promise<ProviderWorkerZipImportResult> {
  const client = input.prismaClient ?? prisma;
  const getRequestMetadata = input.getRequestMetadata ?? getWorkerZipRequestMetadata;
  const runImport = input.runImport ?? runProviderWorkerZipImport;
  const resolvePack = input.resolvePack ?? resolveAdminDraftPack;

  const { pack, version } = await resolvePack(client, {
    userId: input.adminUserId,
    clientId: input.clientId,
    packId: input.packId,
  });

  await assertNotAlreadyRunning(client, pack.packId);

  // Unit-test seam: exercise Admin orchestration without Object Storage I/O.
  if (input.testOverrides?.sourceRevision && input.testOverrides.skipWorkingCopyPersistence) {
    return executeTestOverrideGeneration({
      input,
      client,
      pack,
      version,
      getRequestMetadata,
      runImport,
    });
  }

  const openMarker = await findOpenRequestMarker(client, pack.packId);
  const revision = await resolveGenerationSourceRevision({
    input,
    client,
    pack,
    version,
    openMarker,
    getRequestMetadata,
  });

  const { scopeSummary, liveExcludePaths, inventoryItemIdByPath } =
    await prepareInventoryForGeneration({
      input,
      client,
      pack,
      version,
      revision,
      getRequestMetadata,
    });

  await lockRequestMarkerOnExecute({ client, openMarker, version, revision });

  const { workingCopy } = await loadAndVerifyWorkingCopy({
    input,
    client,
    workingCopyId: scopeSummary.workingCopyId!,
    scopeSummary,
  });

  const result = await executeWorkingCopyWorkerRun({
    input,
    client,
    pack,
    workingCopy,
    revision,
    scopeSummary,
    liveExcludePaths,
    inventoryItemIdByPath,
    runImport,
  });

  if (result.ok) {
    await finalizeSuccessfulGeneration({
      client,
      pack,
      version,
      revision,
      workingCopy,
      openMarker,
    });
  } else {
    await failGenerationOnImportError({
      client,
      workingCopyId: workingCopy.id,
      result,
    });
  }

  return result;
}
