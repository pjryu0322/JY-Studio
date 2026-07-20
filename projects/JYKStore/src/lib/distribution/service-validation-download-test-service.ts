import { PackStatus } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { resolveCurrentValidationBindingTx } from "@/lib/distribution/service-validation-binding";
import {
  assertDownloadCommitBindingMatches,
  assertDownloadCommitFileEvidenceMatches,
  assertDownloadCommitPackEditable,
  assertDownloadCommitRunEligible,
  assertPersistedDownloadTestEvidence,
  resolveExistingDownloadTestEvidence,
} from "@/lib/distribution/service-validation-download-test-policy";
import { asRecord } from "@/lib/distribution/service-validation-policy";
import {
  loadOwnedPackForServiceValidationRead,
  resolveRunCurrentValidity,
} from "@/lib/distribution/service-validation-service";
import { prisma } from "@/lib/prisma";

export type PreparedProviderDownloadTest = {
  runId: string;
  packId: string;
  versionId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  contentLength: number;
  /** Object-storage stream when present; RAG Export uses `bodyBytes` instead. */
  stream: import("node:stream").Readable | null;
  /** In-memory ZIP bytes for RAG Export (avoids Node stream helpers under Next bundling). */
  bodyBytes?: Uint8Array;
  existingEvidence: boolean;
};

/** Pure: only DRAFT packs may run a test download. */
function assertPackDraftEditableForDownloadTest(pack: { status: PackStatus }): void {
  if (pack.status !== PackStatus.DRAFT) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_NOT_EDITABLE",
      "검수요청 전 초안 상태에서만 테스트 다운로드를 실행할 수 있습니다.",
      403,
    );
  }
}

type DownloadTestRun = NonNullable<
  Awaited<ReturnType<typeof prisma.serviceValidationRun.findUnique>>
> & {
  confirmation: unknown;
  downloadTest: { responseReady: boolean } | null;
};

/** DB + policy: load the run and require it be a confirmable, PASSing DOWNLOAD run. */
async function loadEligibleDownloadTestRun(input: {
  runId: string;
  packId: string;
  versionId: string;
}): Promise<DownloadTestRun> {
  const run = await prisma.serviceValidationRun.findUnique({
    where: { id: input.runId },
    include: { confirmation: true, downloadTest: true },
  });
  if (!run || run.packId !== input.packId || run.versionId !== input.versionId) {
    throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
  }
  if (run.confirmation) {
    throw new PayloadServiceError(
      "SERVICE_CONFIRMATION_ALREADY_RECORDED",
      "품질 확인이 기록된 뒤에는 테스트 다운로드 증적을 변경할 수 없습니다.",
      403,
    );
  }
  if (run.channel !== "DOWNLOAD" || run.status !== "PASS") {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_REQUIRED",
      "다운로드 검증이 완료된 실행에서만 테스트 다운로드할 수 있습니다.",
      400,
    );
  }
  return run as DownloadTestRun;
}

/** DB + policy: the run must still be CURRENT against the live knowledge binding. */
async function assertDownloadTestRunCurrent(
  run: Pick<
    DownloadTestRun,
    "pipelineRunId" | "fingerprint" | "indexGenerationId" | "invalidatedAt" | "status" | "channel"
  >,
  packId: string,
  versionId: string,
): Promise<void> {
  const binding = await resolveCurrentValidationBindingTx(prisma, {
    packId,
    versionId,
    expectedPipelineRunId: run.pipelineRunId,
  });
  const validity = resolveRunCurrentValidity({
    run,
    bindingFingerprint: binding.fingerprint,
    bindingIndexGenerationId: binding.indexGenerationId,
    resultItemCount: null,
  });
  if (validity !== "CURRENT") {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "지식 데이터가 변경되어 다운로드 검증을 다시 실행해야 합니다.",
      400,
    );
  }
}

/** Pure: map a caught RAG-export build error to the matching payload error code. */
async function ragExportBuildErrorToPayloadError(err: unknown): Promise<never> {
  const { RagExportBuildError } = await import("@/lib/exports/rag-export-builder");
  if (err instanceof RagExportBuildError) {
    const code =
      err.code === "RAG_EXPORT_BINDING_STALE" ||
      err.code === "RAG_EXPORT_BUILD_FAILED" ||
      err.code === "RAG_EXPORT_FINGERPRINT_MISMATCH" ||
      err.code === "RAG_EXPORT_CHUNK_EMPTY" ||
      err.code === "RAG_EXPORT_SOURCE_TRACE_INVALID"
        ? err.code
        : "RAG_EXPORT_BUILD_FAILED";
    throw new PayloadServiceError(code, err.message, 409);
  }
  throw err;
}

/** Rebuilds the RAG Export package and validates it still matches the run's recorded fingerprint. */
async function prepareRagExportDownloadTest(input: {
  run: DownloadTestRun;
  packId: string;
  versionId: string;
  details: Record<string, unknown>;
}): Promise<PreparedProviderDownloadTest> {
  const { run, details } = input;
  const expectedFp =
    typeof details.exportFingerprint === "string" ? details.exportFingerprint : null;
  const expectedName = typeof details.fileName === "string" ? details.fileName : "rag-export.zip";
  if (!expectedFp) {
    throw new PayloadServiceError(
      "RAG_EXPORT_FINGERPRINT_MISMATCH",
      "RAG Export 검증 증적이 올바르지 않습니다. 다시 검증해 주세요.",
      409,
    );
  }
  const { buildRagExportPackage } = await import("@/lib/exports/rag-export-builder");
  const pkg = await buildRagExportPackage({
    packId: input.packId,
    versionId: input.versionId,
    expectedPipelineRunId: run.pipelineRunId ?? undefined,
    expectedSearchIndexGenerationId: run.indexGenerationId ?? undefined,
    expectedNormalizedDocumentId: run.normalizedDocumentId ?? undefined,
    expectedFingerprint: run.fingerprint ?? undefined,
    includeZipBytes: true,
  }).catch(ragExportBuildErrorToPayloadError);
  if (pkg.exportFingerprint !== expectedFp || !pkg.zipBytes) {
    throw new PayloadServiceError(
      "RAG_EXPORT_FINGERPRINT_MISMATCH",
      "검증 이후 검색데이터가 변경되었습니다. RAG Export를 다시 검증해 주세요.",
      409,
    );
  }
  return {
    runId: run.id,
    packId: input.packId,
    versionId: input.versionId,
    fileId: expectedFp,
    fileName: expectedName,
    mimeType: "application/zip",
    contentLength: pkg.zipBytes.byteLength,
    stream: null,
    bodyBytes: pkg.zipBytes,
    existingEvidence: Boolean(run.downloadTest?.responseReady),
  };
}

/** Legacy original-file DOWNLOAD runs are always STALE; never stream SOURCE_ORIGINAL. */
function rejectLegacyDownloadTest(details: Record<string, unknown> | null): never {
  const fileId = typeof details?.fileId === "string" ? details.fileId : null;
  if (!fileId) {
    throw new PayloadServiceError(
      "DOWNLOAD_OBJECT_NOT_FOUND",
      "RAG Export 검증을 다시 실행해 주세요.",
      404,
    );
  }
  throw new PayloadServiceError(
    "SERVICE_VALIDATION_STALE",
    "이전 원본문서 다운로드 검증은 더 이상 유효하지 않습니다. RAG Export를 다시 검증해 주세요.",
    409,
  );
}

/**
 * Validates download-test eligibility and opens the object stream.
 * Does not write evidence — call commitSuccessfulDownloadTestEvidence after headers/body are ready.
 */
export async function prepareProviderDownloadTest(input: {
  userId: string;
  clientId: string;
  packId: string;
  runId: string;
}): Promise<PreparedProviderDownloadTest> {
  const { pack, version } = await loadOwnedPackForServiceValidationRead(input);
  assertPackDraftEditableForDownloadTest(pack);
  const run = await loadEligibleDownloadTestRun({
    runId: input.runId,
    packId: pack.packId,
    versionId: version.id,
  });
  await assertDownloadTestRunCurrent(run, pack.packId, version.id);
  const details = asRecord(run.details);

  if (details?.downloadMode === "RAG_EXPORT") {
    return prepareRagExportDownloadTest({
      run,
      packId: pack.packId,
      versionId: version.id,
      details,
    });
  }
  rejectLegacyDownloadTest(details);
}

async function assertSourceOriginalFileExists(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: { fileId: string; packId: string; versionId: string },
): Promise<void> {
  const file = await tx.knowledgePackFile.findFirst({
    where: {
      id: input.fileId,
      packId: input.packId,
      versionId: input.versionId,
      role: "SOURCE_ORIGINAL",
      bundle: {
        isActive: true,
        deletedAt: null,
        storageStatus: "ACTIVE",
      },
    },
    select: { id: true },
  });
  if (!file) {
    throw new PayloadServiceError(
      "DOWNLOAD_OBJECT_NOT_FOUND",
      "원본문서(SOURCE_ORIGINAL)를 찾을 수 없습니다.",
      404,
    );
  }
}

/**
 * Create-only evidence after stream open + response headers are ready.
 * Re-validates Pack/Run/Confirmation/Binding inside a transaction.
 * Concurrent creates use createMany(skipDuplicates) — never re-query a failed TX after P2002.
 */
export async function commitSuccessfulDownloadTestEvidence(input: {
  userId: string;
  packId: string;
  versionId: string;
  runId: string;
  fileId: string;
}): Promise<{ fileId: string; testedAt: string; created: boolean }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT "id"
      FROM "KnowledgePack"
      WHERE "packId" = ${input.packId}
      FOR UPDATE
    `;
    const pack = await tx.knowledgePack.findUnique({
      where: { packId: input.packId },
      select: { packId: true, status: true },
    });
    assertDownloadCommitPackEditable(pack);

    const run = await tx.serviceValidationRun.findUnique({
      where: { id: input.runId },
      include: { confirmation: true, downloadTest: true },
    });
    assertDownloadCommitRunEligible({
      run,
      packId: input.packId,
      versionId: input.versionId,
    });
    if (!run || !run.pipelineRunId) {
      throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
    }
    const eligibleRun = run;

    const binding = await resolveCurrentValidationBindingTx(tx, {
      packId: input.packId,
      versionId: input.versionId,
      expectedPipelineRunId: eligibleRun.pipelineRunId,
    });
    assertDownloadCommitBindingMatches({ run: eligibleRun, binding });

    const details =
      eligibleRun.details && typeof eligibleRun.details === "object" && !Array.isArray(eligibleRun.details)
        ? (eligibleRun.details as Record<string, unknown>)
        : null;
    const { isRagExport } = assertDownloadCommitFileEvidenceMatches({
      details,
      fileId: input.fileId,
    });
    if (!isRagExport) {
      await assertSourceOriginalFileExists(tx, {
        fileId: input.fileId,
        packId: input.packId,
        versionId: input.versionId,
      });
    }

    const existing = resolveExistingDownloadTestEvidence({
      downloadTest: eligibleRun.downloadTest,
      fileId: input.fileId,
    });
    if (existing) return existing;

    const inserted = await tx.serviceValidationDownloadTest.createMany({
      data: [
        {
          runId: eligibleRun.id,
          fileId: input.fileId,
          testedByUserId: input.userId,
          responseReady: true,
        },
      ],
      skipDuplicates: true,
    });

    const evidence = await tx.serviceValidationDownloadTest.findUnique({
      where: { runId: eligibleRun.id },
    });
    return assertPersistedDownloadTestEvidence({
      evidence,
      fileId: input.fileId,
      created: inserted.count === 1,
    });
  });
}

/** @deprecated Prefer commitSuccessfulDownloadTestEvidence */
export async function recordSuccessfulDownloadTestEvidence(input: {
  userId: string;
  packId: string;
  versionId: string;
  runId: string;
  fileId: string;
}): Promise<{ fileId: string; testedAt: string; created: boolean }> {
  return commitSuccessfulDownloadTestEvidence(input);
}

export async function requireOwnedRunForPreview(input: {
  userId: string;
  clientId: string;
  packId: string;
  runId: string;
  rank: number;
}) {
  const { pack, version } = await loadOwnedPackForServiceValidationRead(input);
  const run = await prisma.serviceValidationRun.findUnique({ where: { id: input.runId } });
  if (!run || run.packId !== pack.packId || run.versionId !== version.id) {
    throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
  }
  const item = await prisma.serviceValidationResultItem.findFirst({
    where: { runId: run.id, rank: input.rank },
  });
  if (!item) {
    throw new PayloadServiceError("NOT_FOUND", "검색 결과 항목을 찾을 수 없습니다.", 404);
  }
  return { pack, version, run, item };
}
