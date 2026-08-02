import { prisma } from "@/lib/prisma";
import { getWorkerZipRequestMetadata } from "@/lib/python-worker/worker-zip-request-storage";
import { WORKER_ZIP_REQUEST_ACCEPTED_STATUS, WORKER_ZIP_REQUEST_TRIGGER } from "../constants";
import { WorkerZipImportServiceError } from "../errors";
import type {
  OpenRequestMarker,
  ResolvedAdminGenerationPack,
  RunAdminWorkerZipGenerationInput,
} from "./types";

export async function assertNotAlreadyRunning(
  client: typeof prisma,
  packId: string,
): Promise<void> {
  const running = await client.pipelineRun.findFirst({
    where: { packId, triggerType: "WORKER_ZIP_IMPORT", status: "RUNNING" },
    select: { id: true },
  });
  if (running) {
    throw new WorkerZipImportServiceError(
      "ALREADY_RUNNING",
      "이미 지식데이터 생성이 진행 중입니다. 완료 후 다시 시도하세요.",
      409,
    );
  }
}

export async function findOpenRequestMarker(
  client: typeof prisma,
  packId: string,
): Promise<OpenRequestMarker | null> {
  return client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: WORKER_ZIP_REQUEST_TRIGGER,
      status: { in: ["PENDING", WORKER_ZIP_REQUEST_ACCEPTED_STATUS] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, sourceRevisionId: true, versionId: true, status: true },
  });
}

export async function resolveGenerationSourceRevision(args: {
  input: RunAdminWorkerZipGenerationInput;
  client: typeof prisma;
  pack: ResolvedAdminGenerationPack["pack"];
  version: ResolvedAdminGenerationPack["version"];
  openMarker: OpenRequestMarker | null;
  getRequestMetadata: typeof getWorkerZipRequestMetadata;
}) {
  const { input, client, pack, version, openMarker, getRequestMetadata } = args;
  const {
    lazyBackfillWorkerZipSourceRevisionFromLegacy,
    getWorkerZipSourceRevisionById,
    repairUnsafeWorkerZipSourceRevisionStorageKey,
    WorkerZipSourceRevisionError,
  } = await import("@/lib/python-worker/worker-zip-source-revision-service");

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

  return revision;
}

export async function prepareInventoryForGeneration(args: {
  input: RunAdminWorkerZipGenerationInput;
  client: typeof prisma;
  pack: ResolvedAdminGenerationPack["pack"];
  version: ResolvedAdminGenerationPack["version"];
  revision: { id: string };
  getRequestMetadata: typeof getWorkerZipRequestMetadata;
}) {
  const { input, client, pack, version, revision, getRequestMetadata } = args;

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

  return {
    scopeSummary,
    liveExcludePaths,
    inventoryItemIdByPath,
  };
}

export async function lockRequestMarkerOnExecute(args: {
  client: typeof prisma;
  openMarker: OpenRequestMarker | null;
  version: ResolvedAdminGenerationPack["version"];
  revision: { id: string };
}): Promise<void> {
  const { client, openMarker, version, revision } = args;
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
}

export async function loadAndVerifyWorkingCopy(args: {
  input: RunAdminWorkerZipGenerationInput;
  client: typeof prisma;
  workingCopyId: string;
  /** Full inventory summary — forwarded to assertInventoryMatchesWorkingCopyBytes. */
  scopeSummary: { id: string };
}) {
  const { input, client, workingCopyId, scopeSummary } = args;
  const {
    getWorkerZipWorkingCopyById,
    getWorkerZipWorkingCopyBytes,
    WorkerZipWorkingCopyError,
  } = await import("@/lib/python-worker/worker-zip-working-copy-service");
  const { assertInventoryMatchesWorkingCopyBytes } = await import(
    "@/lib/knowledge-scope/inventory-consistency"
  );
  const { KnowledgeScopeInventoryError } = await import("@/lib/knowledge-scope/inventory-types");

  const workingCopy = await getWorkerZipWorkingCopyById({
    workingCopyId,
    prismaClient: client,
  });
  if (!workingCopy) {
    throw new WorkerZipImportServiceError(
      "WORKING_COPY_REQUIRED",
      "Inventory에 연결된 Working Copy를 찾을 수 없습니다.",
      409,
    );
  }

  try {
    const wcBytes = await getWorkerZipWorkingCopyBytes({
      workingCopy,
      env: input.env,
    });
    await assertInventoryMatchesWorkingCopyBytes({
      inventory: scopeSummary as Parameters<typeof assertInventoryMatchesWorkingCopyBytes>[0]["inventory"],
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

  return { workingCopy };
}
