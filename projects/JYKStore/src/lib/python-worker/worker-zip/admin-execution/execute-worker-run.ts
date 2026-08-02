import { prisma } from "@/lib/prisma";
import {
  getWorkerZipRequestBytes,
  getWorkerZipRequestMetadata,
} from "@/lib/python-worker/worker-zip-request-storage";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS, WORKER_ZIP_REQUEST_TRIGGER } from "../constants";
import { WorkerZipImportServiceError } from "../errors";
import {
  runProviderWorkerZipImport,
  type ProviderWorkerZipImportResult,
} from "../import-run";
import { resolveAdminDraftPack } from "../pack-resolvers";
import type {
  ResolvedAdminGenerationPack,
  RunAdminWorkerZipGenerationInput,
} from "./types";

/**
 * Unit-test seam: exercise Admin orchestration without Object Storage I/O.
 */
export async function executeTestOverrideGeneration(args: {
  input: RunAdminWorkerZipGenerationInput;
  client: typeof prisma;
  pack: ResolvedAdminGenerationPack["pack"];
  version: ResolvedAdminGenerationPack["version"];
  getRequestMetadata: typeof getWorkerZipRequestMetadata;
  runImport: typeof runProviderWorkerZipImport;
}): Promise<ProviderWorkerZipImportResult> {
  const { input, client, pack, version, getRequestMetadata, runImport } = args;
  const { withTempFileFromStream } = await import("@/lib/object-storage/stream-object-helpers");
  const { Readable } = await import("node:stream");
  const revision = {
    ...input.testOverrides!.sourceRevision!,
    clientId: input.testOverrides!.sourceRevision!.clientId ?? input.clientId,
    revisionNo: input.testOverrides!.sourceRevision!.revisionNo ?? 1,
    originalFileName: input.testOverrides!.sourceRevision!.originalFileName ?? "source.zip",
    submittedById: input.testOverrides!.sourceRevision!.submittedById ?? null,
    reason: input.testOverrides!.sourceRevision!.reason ?? null,
    status: input.testOverrides!.sourceRevision!.status ?? "UPLOADED",
    supersedesRevisionId: input.testOverrides!.sourceRevision!.supersedesRevisionId ?? null,
    createdAt: input.testOverrides!.sourceRevision!.createdAt ?? new Date(),
    readyAt: input.testOverrides!.sourceRevision!.readyAt ?? null,
    supersededAt: input.testOverrides!.sourceRevision!.supersededAt ?? null,
    reused: false as const,
  };
  const getRequestBytes = input.getRequestBytes ?? getWorkerZipRequestBytes;
  const bytes =
    (await getRequestBytes({
      packId: pack.packId,
      packVersionId: version.id,
      env: input.env,
    })) ?? new Uint8Array();
  if (bytes.byteLength === 0) {
    throw new WorkerZipImportServiceError(
      "REQUEST_SOURCE_REVISION_MISSING",
      "생성 요청에 연결된 원본 revision이 없습니다. 제공자에게 자료 등록을 요청하세요.",
      404,
    );
  }
  const requestMeta = await getRequestMetadata({
    packId: pack.packId,
    packVersionId: version.id,
    env: input.env,
  });
  let adminExcludePaths =
    input.testOverrides!.adminExcludePaths ??
    requestMeta?.adminPreflightExclusions?.paths ??
    [];

  const {
    listInventoryItemsForWorkerManifest,
  } = await import("@/lib/knowledge-scope/inventory-query-service");
  const {
    buildWorkerInputManifestFromItems,
    mergeAdminExcludePaths,
  } = await import("@/lib/knowledge-scope/inventory-worker-manifest");

  // Test seam: treat scope as FINALIZED WC-bound inventory without DB I/O.
  const scopeSummary = {
    id: `inv_test_${revision.id}`,
    packId: pack.packId,
    versionId: version.id,
    sourceRevisionId: revision.id,
    workingCopyId: `swc_test_${revision.id}`,
    inventorySourceFingerprint: "test-fingerprint",
    status: "FINALIZED" as const,
    counts: {
      total: 1,
      included: 1,
      excluded: 0,
      excludedBySystem: 0,
      excludedByAdmin: 0,
      excludedByProvider: 0,
      pending: 0,
      reviewRequired: 0,
      providerRequested: 0,
    },
    finalizedAt: new Date().toISOString(),
    finalizedByUserId: input.adminUserId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Prefer injected excludes; optional DB manifest when prisma stub provides items.
  let inventoryExcludePaths: string[] = [];
  try {
    const manifestItems = await listInventoryItemsForWorkerManifest(scopeSummary.id, client);
    inventoryExcludePaths = buildWorkerInputManifestFromItems(manifestItems).excludePaths;
  } catch {
    inventoryExcludePaths = [];
  }
  adminExcludePaths = mergeAdminExcludePaths(adminExcludePaths, inventoryExcludePaths);

  const workingCopyId = scopeSummary.workingCopyId;
  const result = await withTempFileFromStream(Readable.from(Buffer.from(bytes)), (inputZipPath) =>
    runImport({
      userId: input.adminUserId,
      clientId: input.clientId,
      packId: pack.packId,
      inputZipPath,
      adminExcludePaths,
      sourceRevisionId: revision.id,
      workingCopyId,
      requirePgvector: input.requirePgvector,
      env: input.env,
      prismaClient: input.prismaClient,
      resolvePack: resolveAdminDraftPack,
    }),
  );
  if (result.ok) {
    const { activateWorkerZipSourceRevision } = await import(
      "@/lib/python-worker/worker-zip-source-revision-service"
    );
    await activateWorkerZipSourceRevision({
      revisionId: revision.id,
      versionId: version.id,
      workingCopyId,
      prismaClient: client,
    }).catch(() => undefined);
    await client.pipelineRun
      .updateMany({
        where: {
          packId: pack.packId,
          triggerType: WORKER_ZIP_REQUEST_TRIGGER,
          status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
        },
        data: { status: "PASS", finishedAt: new Date() },
      })
      .catch(() => undefined);
  }
  return result;
}

/**
 * Stream Working Copy to a temp file and invoke the ZIP import pipeline.
 */
export async function executeWorkingCopyWorkerRun(args: {
  input: RunAdminWorkerZipGenerationInput;
  client: typeof prisma;
  pack: ResolvedAdminGenerationPack["pack"];
  workingCopy: {
    id: string;
    storageKey: string;
    checksumSha256: string;
    sizeBytes: number;
  };
  revision: { id: string };
  scopeSummary: { id: string };
  liveExcludePaths: string[];
  inventoryItemIdByPath: Record<string, string>;
  runImport: typeof runProviderWorkerZipImport;
}): Promise<ProviderWorkerZipImportResult> {
  const {
    input,
    client,
    pack,
    workingCopy,
    revision,
    scopeSummary,
    liveExcludePaths,
    inventoryItemIdByPath,
    runImport,
  } = args;

  const {
    markWorkerZipWorkingCopyProcessing,
    markWorkerZipWorkingCopyFailed,
    withVerifiedWorkingCopyTempFile,
    WorkerZipWorkingCopyError,
  } = await import("@/lib/python-worker/worker-zip-working-copy-service");

  await markWorkerZipWorkingCopyProcessing({
    workingCopyId: workingCopy.id,
    prismaClient: client,
  });

  try {
    return await withVerifiedWorkingCopyTempFile({
      workingCopy,
      env: input.env,
      fn: (inputZipPath) =>
        runImport({
          userId: input.adminUserId,
          clientId: input.clientId,
          packId: pack.packId,
          inputZipPath,
          // Inventory INCLUDED-only SoT: prefer live merged excludes over accept-time directive.
          adminExcludePaths: liveExcludePaths,
          sourceRevisionId: revision.id,
          workingCopyId: workingCopy.id,
          inventoryId: scopeSummary.id,
          inventoryItemIdByPath,
          requirePgvector: input.requirePgvector,
          env: input.env,
          prismaClient: input.prismaClient,
          resolvePack: resolveAdminDraftPack,
        }),
    });
  } catch (error) {
    const code =
      error instanceof WorkerZipWorkingCopyError
        ? error.code
        : "WORKING_COPY_STREAM_FAILED";
    const message =
      error instanceof Error ? error.message : "Working Copy 스트리밍에 실패했습니다.";
    await markWorkerZipWorkingCopyFailed({
      workingCopyId: workingCopy.id,
      failureCode: code,
      failureMessage: message,
      prismaClient: client,
    });
    if (error instanceof WorkerZipWorkingCopyError) {
      throw new WorkerZipImportServiceError(error.code, error.message, error.httpStatus);
    }
    throw error;
  }
}
