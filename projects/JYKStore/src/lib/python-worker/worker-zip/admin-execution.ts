/* ------------------------------------------------------------------ *
 * P7.3: Admin "지식데이터 생성 실행" — execution authority lives here only.
 * ------------------------------------------------------------------ */
import { prisma } from "@/lib/prisma";
import {
  getWorkerZipRequestBytes,
  getWorkerZipRequestMetadata,
} from "@/lib/python-worker/worker-zip-request-storage";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS, WORKER_ZIP_REQUEST_TRIGGER } from "./constants";
import { WorkerZipImportServiceError } from "./errors";
import { runProviderWorkerZipImport, type ProviderWorkerZipImportResult } from "./import-run";
import { resolveAdminDraftPack, type WorkerZipPackResolver } from "./pack-resolvers";

export type RunAdminWorkerZipGenerationInput = {
  adminUserId: string;
  clientId: string;
  packId: string;
  requirePgvector?: boolean;
  env?: NodeJS.ProcessEnv;
  prismaClient?: typeof prisma;
  /** @deprecated P1.1 uses Working Copy streaming; retained only for older call sites. */
  getRequestBytes?: typeof getWorkerZipRequestBytes;
  getRequestMetadata?: typeof getWorkerZipRequestMetadata;
  runImport?: typeof runProviderWorkerZipImport;
  resolvePack?: WorkerZipPackResolver;
  /**
   * Test hook: bypass revision lookup / Working Copy object I/O.
   * Production callers must omit this.
   */
  testOverrides?: {
    sourceRevision?: {
      id: string;
      clientId?: string | null;
      packId: string;
      versionId: string;
      revisionNo?: number;
      storageKey: string;
      checksumSha256: string;
      sizeBytes: number;
      originalFileName?: string | null;
      submittedById?: string | null;
      reason?: string | null;
      status?: "UPLOADED" | "PROCESSING" | "READY" | "REJECTED" | "SUPERSEDED";
      supersedesRevisionId?: string | null;
      createdAt?: Date;
      readyAt?: Date | null;
      supersededAt?: Date | null;
    };
    adminExcludePaths?: string[];
    skipWorkingCopyPersistence?: boolean;
  };
};

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

  // Prevent duplicate execution while a run is already in progress.
  const running = await client.pipelineRun.findFirst({
    where: { packId: pack.packId, triggerType: "WORKER_ZIP_IMPORT", status: "RUNNING" },
    select: { id: true },
  });
  if (running) {
    throw new WorkerZipImportServiceError(
      "ALREADY_RUNNING",
      "이미 지식데이터 생성이 진행 중입니다. 완료 후 다시 시도하세요.",
      409,
    );
  }

  // Unit-test seam: exercise Admin orchestration without Object Storage I/O.
  if (input.testOverrides?.sourceRevision && input.testOverrides.skipWorkingCopyPersistence) {
    const { withTempFileFromStream } = await import("@/lib/object-storage/stream-object-helpers");
    const { Readable } = await import("node:stream");
    const revision = {
      ...input.testOverrides.sourceRevision,
      clientId: input.testOverrides.sourceRevision.clientId ?? input.clientId,
      revisionNo: input.testOverrides.sourceRevision.revisionNo ?? 1,
      originalFileName: input.testOverrides.sourceRevision.originalFileName ?? "source.zip",
      submittedById: input.testOverrides.sourceRevision.submittedById ?? null,
      reason: input.testOverrides.sourceRevision.reason ?? null,
      status: input.testOverrides.sourceRevision.status ?? "UPLOADED",
      supersedesRevisionId: input.testOverrides.sourceRevision.supersedesRevisionId ?? null,
      createdAt: input.testOverrides.sourceRevision.createdAt ?? new Date(),
      readyAt: input.testOverrides.sourceRevision.readyAt ?? null,
      supersededAt: input.testOverrides.sourceRevision.supersededAt ?? null,
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
      input.testOverrides.adminExcludePaths ??
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

  const {
    lazyBackfillWorkerZipSourceRevisionFromLegacy,
    getWorkerZipSourceRevisionById,
    repairUnsafeWorkerZipSourceRevisionStorageKey,
    activateWorkerZipSourceRevision,
    WorkerZipSourceRevisionError,
  } = await import("@/lib/python-worker/worker-zip-source-revision-service");
  const {
    markWorkerZipWorkingCopyProcessing,
    markWorkerZipWorkingCopyFailed,
    withVerifiedWorkingCopyTempFile,
    WorkerZipWorkingCopyError,
  } = await import("@/lib/python-worker/worker-zip-working-copy-service");

  const openMarker = await client.pipelineRun.findFirst({
    where: {
      packId: pack.packId,
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, sourceRevisionId: true, versionId: true, status: true },
  });

  let sourceRevisionId = openMarker?.sourceRevisionId ?? null;
  if (!sourceRevisionId) {
    const requestMeta = await getRequestMetadata({
      packId: pack.packId,
      packVersionId: version.id,
      env: input.env,
    });
    sourceRevisionId = requestMeta?.sourceRevisionId ?? null;
  }

  let revision = sourceRevisionId
    ? await getWorkerZipSourceRevisionById({
        revisionId: sourceRevisionId,
        clientId: input.clientId,
        packId: pack.packId,
        versionId: version.id,
        prismaClient: client,
        requireSafeStorageKey: false,
      })
    : null;

  if (!revision) {
    revision = await lazyBackfillWorkerZipSourceRevisionFromLegacy({
      packId: pack.packId,
      versionId: version.id,
      clientId: input.clientId,
      env: input.env,
      prismaClient: client,
    });
    if (revision && openMarker) {
      await client.pipelineRun.update({
        where: { id: openMarker.id },
        data: { sourceRevisionId: revision.id, versionId: version.id },
      });
    }
  }

  if (!revision) {
    throw new WorkerZipImportServiceError(
      "REQUEST_SOURCE_REVISION_MISSING",
      "생성 요청에 연결된 원본 revision이 없습니다. 제공자에게 자료 등록을 요청하세요.",
      404,
    );
  }

  if (revision.versionId !== version.id || revision.packId !== pack.packId) {
    throw new WorkerZipImportServiceError(
      "REQUEST_SOURCE_REVISION_MISMATCH",
      "요청 marker의 원본 revision이 현재 팩/버전과 일치하지 않습니다.",
      409,
    );
  }

  try {
    const { isWorkerRequestStableZipObjectKey } = await import(
      "@/lib/python-worker/worker-output-object-keys"
    );
    if (isWorkerRequestStableZipObjectKey(revision.storageKey)) {
      revision = await repairUnsafeWorkerZipSourceRevisionStorageKey({
        revisionId: revision.id,
        env: input.env,
        prismaClient: client,
      });
    }
  } catch (error) {
    if (error instanceof WorkerZipSourceRevisionError) {
      throw new WorkerZipImportServiceError(error.code, error.message, error.httpStatus);
    }
    throw error;
  }

  const requestMeta = await getRequestMetadata({
    packId: pack.packId,
    packVersionId: version.id,
    env: input.env,
  });
  let liveExcludePaths = requestMeta?.adminPreflightExclusions?.paths ?? [];

  const {
    getKnowledgeScopeInventoryBySourceRevision,
    listInventoryItemsForWorkerManifest,
  } = await import("@/lib/knowledge-scope/inventory-query-service");
  const { isKnowledgeScopeReadyForGeneration } = await import("@/lib/knowledge-scope/inventory-gate");
  const {
    buildWorkerInputManifestFromItems,
    mergeAdminExcludePaths,
    assertIncludedItemsMatchWorkerCapability,
    buildInventoryItemIdByPath,
  } = await import("@/lib/knowledge-scope/inventory-worker-manifest");
  const { KnowledgeScopeInventoryError } = await import("@/lib/knowledge-scope/inventory-types");

  const scopeSummary = await getKnowledgeScopeInventoryBySourceRevision({
    versionId: version.id,
    sourceRevisionId: revision.id,
    prismaClient: client,
  });
  if (!isKnowledgeScopeReadyForGeneration(scopeSummary)) {
    throw new WorkerZipImportServiceError(
      "KNOWLEDGE_SCOPE_NOT_READY",
      "지식화 대상 범위가 확정되지 않았습니다. 지식 범위 인벤토리를 완료한 뒤 생성하세요.",
      409,
    );
  }
  if (!scopeSummary?.workingCopyId) {
    throw new WorkerZipImportServiceError(
      "WORKING_COPY_REQUIRED",
      "Inventory에 Working Copy가 연결되어 있지 않습니다. 접수 후 지식화 대상을 다시 확인하세요.",
      409,
    );
  }

  const manifestItems = await listInventoryItemsForWorkerManifest(scopeSummary.id, client);
  try {
    assertIncludedItemsMatchWorkerCapability(manifestItems);
  } catch (error) {
    if (error instanceof KnowledgeScopeInventoryError) {
      throw new WorkerZipImportServiceError(error.code, error.message, error.httpStatus);
    }
    throw error;
  }
  const {
    excludePaths: inventoryExcludePaths,
    includedEntries,
  } = buildWorkerInputManifestFromItems(manifestItems);
  liveExcludePaths = mergeAdminExcludePaths(liveExcludePaths, inventoryExcludePaths);
  const inventoryItemIdByPath = buildInventoryItemIdByPath(includedEntries);

  // Executing implies acceptance: lock the request (접수완료) before running so the
  // Provider can no longer withdraw it mid-generation.
  if (openMarker?.status === "PENDING") {
    await client.pipelineRun.update({
      where: { id: openMarker.id },
      data: {
        status: WORKER_ZIP_REQUEST_ACCEPTED_STATUS,
        versionId: version.id,
        sourceRevisionId: revision.id,
      },
    });
  } else if (openMarker && !openMarker.sourceRevisionId) {
    await client.pipelineRun.update({
      where: { id: openMarker.id },
      data: { versionId: version.id, sourceRevisionId: revision.id },
    });
  }

  const {
    getWorkerZipWorkingCopyById,
    getWorkerZipWorkingCopyBytes,
  } = await import("@/lib/python-worker/worker-zip-working-copy-service");
  const { assertInventoryMatchesWorkingCopyBytes } = await import(
    "@/lib/knowledge-scope/inventory-consistency"
  );

  const workingCopy = await getWorkerZipWorkingCopyById({
    workingCopyId: scopeSummary.workingCopyId,
    prismaClient: client,
  });
  if (!workingCopy) {
    throw new WorkerZipImportServiceError(
      "WORKING_COPY_REQUIRED",
      "Inventory에 연결된 Working Copy를 찾을 수 없습니다.",
      409,
    );
  }

  let wcBytes: Uint8Array;
  try {
    wcBytes = await getWorkerZipWorkingCopyBytes({
      workingCopy,
      env: input.env,
    });
    await assertInventoryMatchesWorkingCopyBytes({
      inventory: scopeSummary,
      workingCopyId: workingCopy.id,
      workingCopySourceRevisionId: workingCopy.sourceRevisionId,
      zipBytes: wcBytes,
    });
  } catch (error) {
    if (error instanceof KnowledgeScopeInventoryError) {
      throw new WorkerZipImportServiceError(error.code, error.message, error.httpStatus);
    }
    if (error instanceof WorkerZipWorkingCopyError) {
      throw new WorkerZipImportServiceError(error.code, error.message, error.httpStatus);
    }
    throw error;
  }

  await markWorkerZipWorkingCopyProcessing({
    workingCopyId: workingCopy.id,
    prismaClient: client,
  });

  let result: ProviderWorkerZipImportResult;
  try {
    result = await withVerifiedWorkingCopyTempFile({
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
          sourceRevisionId: revision!.id,
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

  if (result.ok) {
    try {
      // Re-check marker still points at the same revision before pointer flip.
      if (openMarker) {
        const markerNow = await client.pipelineRun.findUnique({
          where: { id: openMarker.id },
          select: { sourceRevisionId: true },
        });
        if (markerNow?.sourceRevisionId && markerNow.sourceRevisionId !== revision.id) {
          throw new WorkerZipImportServiceError(
            "REQUEST_SOURCE_REVISION_MISMATCH",
            "실행 중 요청 marker의 원본 revision이 변경되었습니다.",
            409,
          );
        }
      }
      await activateWorkerZipSourceRevision({
        revisionId: revision.id,
        versionId: version.id,
        workingCopyId: workingCopy.id,
        prismaClient: client,
      });
      await client.pipelineRun.updateMany({
        where: {
          packId: pack.packId,
          triggerType: WORKER_ZIP_REQUEST_TRIGGER,
          status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
        },
        data: { status: "PASS", finishedAt: new Date() },
      });
    } catch (error) {
      await markWorkerZipWorkingCopyFailed({
        workingCopyId: workingCopy.id,
        failureCode: "SOURCE_ACTIVATION_FAILED",
        failureMessage:
          error instanceof Error ? error.message : "원본/작업본 활성화에 실패했습니다.",
        prismaClient: client,
      });
      throw new WorkerZipImportServiceError(
        "SOURCE_ACTIVATION_FAILED",
        "생성은 완료됐지만 현재 원본·작업본 활성화에 실패했습니다. 기존 현재 pointer는 유지됩니다.",
        500,
      );
    }
  } else {
    await markWorkerZipWorkingCopyFailed({
      workingCopyId: workingCopy.id,
      failureCode: result.error?.code ?? "WORKER_ZIP_IMPORT_FAILED",
      failureMessage: result.error?.message ?? "Worker 실행에 실패했습니다.",
      prismaClient: client,
    });
  }

  return result;
}
