import { randomUUID } from "node:crypto";
import {
  PackStatus,
  ServiceValidationProviderConfirmationStatus,
  type Prisma,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import { getConfiguredPayloadStorage } from "@/lib/distribution/payload-storage-factory";
import {
  resolveCurrentValidationBindingTx,
  type CurrentValidationBinding,
} from "@/lib/distribution/service-validation-binding";
import {
  DOWNLOAD_REJECTION_REASONS,
  RETRIEVAL_REJECTION_REASONS,
} from "@/lib/distribution/service-validation-confirmation-constants";
import {
  requireOwnedDraftPackForServiceValidationRun,
  resolveRunCurrentValidity,
  loadOwnedPackForServiceValidationRead,
} from "@/lib/distribution/service-validation-service";
import { canShareProviderConfirmation } from "@/lib/distribution/service-validation-share";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import type { ObjectStorage } from "@/lib/object-storage/object-storage";
import { prisma } from "@/lib/prisma";

export {
  DOWNLOAD_REJECTION_REASONS,
  RETRIEVAL_REJECTION_REASONS,
} from "@/lib/distribution/service-validation-confirmation-constants";

const COMMENT_MAX = 1000;

function newSharedGroupId(): string {
  return randomUUID().replace(/-/g, "");
}

export type ConfirmRetrievalInput = {
  relevanceConfirmed: boolean;
  contentConfirmed: boolean;
  sourceConfirmed: boolean;
  isolationConfirmed: boolean;
};

export type ConfirmDownloadInput = {
  fileNameConfirmed: boolean;
  downloadOkConfirmed: boolean;
  fileMatchConfirmed: boolean;
};

function assertDraftEditable(packStatus: PackStatus) {
  if (packStatus !== PackStatus.DRAFT) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_NOT_EDITABLE",
      "검수요청 전 초안 상태에서만 품질 확인을 변경할 수 있습니다.",
      403,
    );
  }
}

async function requireOwnedRunnableRun(input: {
  userId: string;
  clientId: string;
  packId: string;
  runId: string;
}) {
  const { pack, version, profile } = await requireOwnedDraftPackForServiceValidationRun(input);
  assertDraftEditable(pack.status);
  const run = await prisma.serviceValidationRun.findUnique({
    where: { id: input.runId },
    include: { confirmation: true, resultItems: { orderBy: { rank: "asc" } }, downloadTest: true },
  });
  if (!run || run.packId !== pack.packId || run.versionId !== version.id) {
    throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
  }
  const binding = await resolveCurrentValidationBindingTx(prisma, {
    packId: pack.packId,
    versionId: version.id,
    expectedPipelineRunId: run.pipelineRunId,
  });
  const validity = resolveRunCurrentValidity({
    run,
    bindingFingerprint: binding.fingerprint,
    bindingIndexGenerationId: binding.indexGenerationId,
    resultItemCount: run.channel === "DOWNLOAD" ? null : run.resultItems.length,
  });
  if (run.status !== "PASS" || validity !== "CURRENT") {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_REQUIRED",
      "시스템 검증이 완료된 현재 결과에서만 품질 확인할 수 있습니다.",
      400,
    );
  }
  if (run.channel !== "DOWNLOAD" && run.resultItems.length < 1) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
      "검색 결과 Snapshot이 없어 품질 확인할 수 없습니다. 다시 검증해 주세요.",
      400,
    );
  }
  return { pack, version, profile, run, binding };
}

async function loadOwnedRunnableRunTx(
  tx: Prisma.TransactionClient,
  input: {
    packId: string;
    runId: string;
    providerProfileId: string;
    expectedVersionId: string;
  },
) {
  await tx.$queryRaw`
    SELECT "id"
    FROM "KnowledgePack"
    WHERE "packId" = ${input.packId}
    FOR UPDATE
  `;
  const pack = await tx.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: input.providerProfileId },
    select: { packId: true, status: true },
  });
  if (!pack) {
    throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  assertDraftEditable(pack.status);

  const currentVersion = await tx.knowledgePackVersion.findFirst({
    where: { packId: input.packId },
    orderBy: latestKnowledgePackVersionOrderBy,
    select: { id: true },
  });
  if (!currentVersion || currentVersion.id !== input.expectedVersionId) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "현재 지식팩 버전이 변경되었습니다. 다시 검증해 주세요.",
      409,
    );
  }

  const run = await tx.serviceValidationRun.findUnique({
    where: { id: input.runId },
    include: {
      confirmation: true,
      resultItems: { orderBy: { rank: "asc" } },
      downloadTest: true,
    },
  });
  if (!run || run.packId !== pack.packId || run.versionId !== currentVersion.id) {
    throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
  }
  const binding = await resolveCurrentValidationBindingTx(tx, {
    packId: pack.packId,
    versionId: currentVersion.id,
    expectedPipelineRunId: run.pipelineRunId,
  });
  if (
    run.status !== "PASS" ||
    run.invalidatedAt ||
    run.pipelineRunId !== binding.pipelineRunId ||
    run.indexGenerationId !== binding.indexGenerationId ||
    run.normalizedDocumentId !== binding.normalizedDocumentId ||
    run.fingerprint !== binding.fingerprint
  ) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_REQUIRED",
      "시스템 검증이 완료된 현재 결과에서만 품질 확인할 수 있습니다.",
      400,
    );
  }
  if (run.channel !== "DOWNLOAD" && run.resultItems.length < 1) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
      "검색 결과 Snapshot이 없어 품질 확인할 수 없습니다. 다시 검증해 주세요.",
      400,
    );
  }
  return { pack, run, binding };
}

async function resolveShareablePeerTx(
  tx: Prisma.TransactionClient,
  run: Awaited<ReturnType<typeof loadOwnedRunnableRunTx>>["run"],
  binding: CurrentValidationBinding,
) {
  const peerChannel = run.channel === "API" ? "MCP" : run.channel === "MCP" ? "API" : null;
  if (!peerChannel) return null;
  const peer = await tx.serviceValidationRun.findFirst({
    where: { versionId: run.versionId, channel: peerChannel },
    orderBy: { createdAt: "desc" },
    include: {
      confirmation: true,
      resultItems: { orderBy: { rank: "asc" } },
    },
  });
  if (
    !peer ||
    peer.confirmation ||
    peer.status !== "PASS" ||
    peer.invalidatedAt ||
    peer.packId !== run.packId ||
    peer.pipelineRunId !== binding.pipelineRunId ||
    peer.indexGenerationId !== binding.indexGenerationId ||
    peer.normalizedDocumentId !== binding.normalizedDocumentId ||
    peer.fingerprint !== binding.fingerprint ||
    peer.resultItems.length < 1
  ) {
    return null;
  }
  const share = canShareProviderConfirmation({
    apiRun: run.channel === "API" ? run : peer,
    mcpRun: run.channel === "MCP" ? run : peer,
    apiResults: (run.channel === "API" ? run.resultItems : peer.resultItems).map((item) => ({
      rank: item.rank,
      chunkId: item.chunkId,
      sourceDocumentId: item.sourceDocumentId,
      pageStart: item.pageStart,
      pageEnd: item.pageEnd,
    })),
    mcpResults: (run.channel === "MCP" ? run.resultItems : peer.resultItems).map((item) => ({
      rank: item.rank,
      chunkId: item.chunkId,
      sourceDocumentId: item.sourceDocumentId,
      pageStart: item.pageStart,
      pageEnd: item.pageEnd,
    })),
    binding: {
      fingerprint: binding.fingerprint,
      indexGenerationId: binding.indexGenerationId,
      normalizedDocumentId: binding.normalizedDocumentId,
      pipelineRunId: binding.pipelineRunId,
    },
  });
  return share ? peer : null;
}

function confirmationMatches(
  row: {
    runId: string;
    status: ServiceValidationProviderConfirmationStatus;
    relevanceConfirmed: boolean;
    contentConfirmed: boolean;
    sourceConfirmed: boolean;
    isolationConfirmed: boolean;
    fileNameConfirmed: boolean;
    downloadOkConfirmed: boolean;
    fileMatchConfirmed: boolean;
    rejectionReason: string | null;
    comment: string | null;
    confirmedByUserId: string;
  },
  expected: Prisma.ServiceValidationProviderConfirmationCreateManyInput,
): boolean {
  return (
    row.runId === expected.runId &&
    row.status === expected.status &&
    row.relevanceConfirmed === Boolean(expected.relevanceConfirmed) &&
    row.contentConfirmed === Boolean(expected.contentConfirmed) &&
    row.sourceConfirmed === Boolean(expected.sourceConfirmed) &&
    row.isolationConfirmed === Boolean(expected.isolationConfirmed) &&
    row.fileNameConfirmed === Boolean(expected.fileNameConfirmed) &&
    row.downloadOkConfirmed === Boolean(expected.downloadOkConfirmed) &&
    row.fileMatchConfirmed === Boolean(expected.fileMatchConfirmed) &&
    row.rejectionReason === (expected.rejectionReason ?? null) &&
    row.comment === (expected.comment ?? null) &&
    row.confirmedByUserId === expected.confirmedByUserId
  );
}

async function createConfirmationsIdempotently(
  tx: Prisma.TransactionClient,
  expectedRows: Prisma.ServiceValidationProviderConfirmationCreateManyInput[],
) {
  await tx.serviceValidationProviderConfirmation.createMany({
    data: expectedRows,
    skipDuplicates: true,
  });
  const rows = await tx.serviceValidationProviderConfirmation.findMany({
    where: { runId: { in: expectedRows.map((row) => row.runId) } },
  });
  for (const expected of expectedRows) {
    const row = rows.find((candidate) => candidate.runId === expected.runId);
    if (!row || !confirmationMatches(row, expected)) {
      throw new PayloadServiceError(
        "SERVICE_CONFIRMATION_ALREADY_RECORDED",
        "다른 품질 확인이 이미 기록된 검증입니다. 다시 검증해 주세요.",
        409,
      );
    }
  }
  return rows;
}

export async function confirmServiceValidationRun(input: {
  userId: string;
  clientId: string;
  packId: string;
  runId: string;
  retrieval?: ConfirmRetrievalInput;
  download?: ConfirmDownloadInput;
}): Promise<{ confirmationId: string; sharedGroupId: string | null; confirmedRunIds: string[] }> {
  const { run, version, profile } = await requireOwnedRunnableRun(input);

  if (run.channel === "DOWNLOAD") {
    const d = input.download;
    if (!d?.fileNameConfirmed || !d.downloadOkConfirmed || !d.fileMatchConfirmed) {
      throw new PayloadServiceError(
        "SERVICE_CONFIRMATION_INCOMPLETE",
        "다운로드 확인 항목을 모두 체크해 주세요.",
        400,
      );
    }
    return prisma.$transaction(async (tx) => {
      const current = await loadOwnedRunnableRunTx(tx, {
        packId: input.packId,
        runId: input.runId,
        providerProfileId: profile.id,
        expectedVersionId: version.id,
      });
      if (current.run.channel !== "DOWNLOAD" || !current.run.downloadTest?.responseReady) {
        throw new PayloadServiceError(
          "SERVICE_DOWNLOAD_TEST_REQUIRED",
          "테스트 다운로드를 먼저 실행해 주세요.",
          400,
        );
      }
      const details =
        current.run.details &&
        typeof current.run.details === "object" &&
        !Array.isArray(current.run.details)
          ? (current.run.details as Record<string, unknown>)
          : null;
      const expectedFileId = typeof details?.fileId === "string" ? details.fileId : null;
      if (!expectedFileId || current.run.downloadTest.fileId !== expectedFileId) {
        throw new PayloadServiceError(
          "SERVICE_DOWNLOAD_TEST_REQUIRED",
          "테스트 다운로드 증적이 검증 결과와 일치하지 않습니다. 다시 검증해 주세요.",
          400,
        );
      }
      const rows = await createConfirmationsIdempotently(tx, [
        {
          runId: current.run.id,
          status: ServiceValidationProviderConfirmationStatus.CONFIRMED,
          fileNameConfirmed: true,
          downloadOkConfirmed: true,
          fileMatchConfirmed: true,
          confirmedByUserId: input.userId,
        },
      ]);
      return {
        confirmationId: rows[0]!.id,
        sharedGroupId: null,
        confirmedRunIds: [current.run.id],
      };
    });
  }

  const r = input.retrieval;
  if (
    !r?.relevanceConfirmed ||
    !r.contentConfirmed ||
    !r.sourceConfirmed ||
    !r.isolationConfirmed
  ) {
    throw new PayloadServiceError(
      "SERVICE_CONFIRMATION_INCOMPLETE",
      "품질 확인 항목을 모두 체크해 주세요.",
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    const current = await loadOwnedRunnableRunTx(tx, {
      packId: input.packId,
      runId: input.runId,
      providerProfileId: profile.id,
      expectedVersionId: version.id,
    });
    if (current.run.channel !== "API" && current.run.channel !== "MCP") {
      throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
    }
    const peer = current.run.confirmation
      ? null
      : await resolveShareablePeerTx(tx, current.run, current.binding);
    const sharedGroupId = peer ? newSharedGroupId() : null;
    const targets = peer ? [current.run, peer] : [current.run];
    const expectedRows = targets.map(
      (target): Prisma.ServiceValidationProviderConfirmationCreateManyInput => ({
        runId: target.id,
        status: ServiceValidationProviderConfirmationStatus.CONFIRMED,
        relevanceConfirmed: true,
        contentConfirmed: true,
        sourceConfirmed: true,
        isolationConfirmed: true,
        confirmedByUserId: input.userId,
        sharedConfirmationGroupId: sharedGroupId,
      }),
    );
    const rows = await createConfirmationsIdempotently(tx, expectedRows);
    const primary = rows.find((row) => row.runId === current.run.id)!;
    return {
      confirmationId: primary.id,
      sharedGroupId: primary.sharedConfirmationGroupId,
      confirmedRunIds: rows
        .filter(
          (row) =>
            row.runId === current.run.id ||
            (primary.sharedConfirmationGroupId &&
              row.sharedConfirmationGroupId === primary.sharedConfirmationGroupId),
        )
        .map((row) => row.runId),
    };
  });
}

export async function rejectServiceValidationRun(input: {
  userId: string;
  clientId: string;
  packId: string;
  runId: string;
  rejectionReason: string;
  comment?: string | null;
}): Promise<{ confirmationId: string }> {
  const { run, version, profile } = await requireOwnedRunnableRun(input);
  const reason = input.rejectionReason.trim();
  const allowed =
    run.channel === "DOWNLOAD" ? DOWNLOAD_REJECTION_REASONS : RETRIEVAL_REJECTION_REASONS;
  if (!(allowed as readonly string[]).includes(reason)) {
    throw new PayloadServiceError(
      "SERVICE_CONFIRMATION_INCOMPLETE",
      "반려 사유를 선택해 주세요.",
      400,
    );
  }
  const comment = input.comment?.trim() || null;
  if (comment && comment.length > COMMENT_MAX) {
    throw new PayloadServiceError(
      "SERVICE_CONFIRMATION_INCOMPLETE",
      `추가 의견은 ${COMMENT_MAX}자 이하여야 합니다.`,
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    const current = await loadOwnedRunnableRunTx(tx, {
      packId: input.packId,
      runId: input.runId,
      providerProfileId: profile.id,
      expectedVersionId: version.id,
    });
    const peer =
      current.run.channel === "DOWNLOAD" || current.run.confirmation
        ? null
        : await resolveShareablePeerTx(tx, current.run, current.binding);
    const sharedGroupId = peer ? newSharedGroupId() : null;
    const targets = peer ? [current.run, peer] : [current.run];
    const expectedRows = targets.map(
      (target): Prisma.ServiceValidationProviderConfirmationCreateManyInput => ({
        runId: target.id,
        status: ServiceValidationProviderConfirmationStatus.REJECTED,
        rejectionReason: reason,
        comment,
        confirmedByUserId: input.userId,
        sharedConfirmationGroupId: sharedGroupId,
      }),
    );
    const rows = await createConfirmationsIdempotently(tx, expectedRows);
    const primary = rows.find((row) => row.runId === current.run.id)!;
    return { confirmationId: primary.id };
  });
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

export type PreparedProviderDownloadTest = {
  runId: string;
  packId: string;
  versionId: string;
  fileId: string;
  fileName: string;
  mimeType: string;
  contentLength: number;
  stream: import("node:stream").Readable;
  existingEvidence: boolean;
};

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
  if (pack.status !== PackStatus.DRAFT) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_NOT_EDITABLE",
      "검수요청 전 초안 상태에서만 테스트 다운로드를 실행할 수 있습니다.",
      403,
    );
  }
  const run = await prisma.serviceValidationRun.findUnique({
    where: { id: input.runId },
    include: { confirmation: true, downloadTest: true },
  });
  if (!run || run.packId !== pack.packId || run.versionId !== version.id) {
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
  const binding = await resolveCurrentValidationBindingTx(prisma, {
    packId: pack.packId,
    versionId: version.id,
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
  const details =
    run.details && typeof run.details === "object" && !Array.isArray(run.details)
      ? (run.details as Record<string, unknown>)
      : null;
  const fileId = typeof details?.fileId === "string" ? details.fileId : null;
  if (!fileId) {
    throw new PayloadServiceError(
      "DOWNLOAD_OBJECT_NOT_FOUND",
      "다운로드 검증에 연결된 원본파일을 찾을 수 없습니다.",
      404,
    );
  }
  const file = await prisma.knowledgePackFile.findFirst({
    where: {
      id: fileId,
      packId: pack.packId,
      versionId: version.id,
      role: "SOURCE_ORIGINAL",
      bundle: {
        isActive: true,
        deletedAt: null,
        storageStatus: "ACTIVE",
      },
    },
  });
  if (!file?.storageKey) {
    throw new PayloadServiceError(
      "DOWNLOAD_OBJECT_NOT_FOUND",
      "원본문서(SOURCE_ORIGINAL)를 찾을 수 없습니다.",
      404,
    );
  }
  const storage = getConfiguredPayloadStorage() as ObjectStorage;
  if (typeof storage.getObjectStream !== "function") {
    throw new PayloadServiceError(
      "DOWNLOAD_OBJECT_NOT_FOUND",
      "Object Storage 스트림을 열 수 없습니다.",
      503,
    );
  }
  let streamed: Awaited<ReturnType<ObjectStorage["getObjectStream"]>>;
  try {
    streamed = await storage.getObjectStream({ objectKey: file.storageKey });
  } catch {
    throw new PayloadServiceError(
      "DOWNLOAD_OBJECT_NOT_FOUND",
      "원본파일을 Object Storage에서 열지 못했습니다.",
      404,
    );
  }
  const headLength =
    typeof streamed.contentLength === "number" && streamed.contentLength > 0
      ? streamed.contentLength
      : Number(file.fileSize);
  return {
    runId: run.id,
    packId: pack.packId,
    versionId: version.id,
    fileId: file.id,
    fileName: file.originalFileName,
    mimeType: file.mimeType || "application/octet-stream",
    contentLength: Number.isFinite(headLength) ? headLength : 0,
    stream: streamed.body,
    existingEvidence: Boolean(run.downloadTest?.responseReady),
  };
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
    if (!pack) {
      throw new PayloadServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
    }
    if (pack.status !== PackStatus.DRAFT) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_NOT_EDITABLE",
        "검수요청 전 초안 상태에서만 테스트 다운로드를 실행할 수 있습니다.",
        403,
      );
    }

    const run = await tx.serviceValidationRun.findUnique({
      where: { id: input.runId },
      include: { confirmation: true, downloadTest: true },
    });
    if (
      !run ||
      run.packId !== input.packId ||
      run.versionId !== input.versionId ||
      run.channel !== "DOWNLOAD"
    ) {
      throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
    }
    if (run.confirmation) {
      throw new PayloadServiceError(
        "SERVICE_CONFIRMATION_ALREADY_RECORDED",
        "품질 확인이 기록된 뒤에는 테스트 다운로드 증적을 변경할 수 없습니다.",
        403,
      );
    }
    if (run.status !== "PASS" || run.invalidatedAt) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_REQUIRED",
        "다운로드 검증이 완료된 실행에서만 테스트 다운로드할 수 있습니다.",
        400,
      );
    }
    if (!run.pipelineRunId) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_STALE",
        "지식 데이터가 변경되어 다운로드 검증을 다시 실행해야 합니다.",
        400,
      );
    }

    const binding = await resolveCurrentValidationBindingTx(tx, {
      packId: input.packId,
      versionId: input.versionId,
      expectedPipelineRunId: run.pipelineRunId,
    });
    if (
      run.indexGenerationId !== binding.indexGenerationId ||
      run.fingerprint !== binding.fingerprint ||
      run.normalizedDocumentId !== binding.normalizedDocumentId
    ) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_STALE",
        "지식 데이터가 변경되어 다운로드 검증을 다시 실행해야 합니다.",
        400,
      );
    }

    const details =
      run.details && typeof run.details === "object" && !Array.isArray(run.details)
        ? (run.details as Record<string, unknown>)
        : null;
    const detailsFileId = typeof details?.fileId === "string" ? details.fileId : null;
    if (!detailsFileId || detailsFileId !== input.fileId) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
        "다운로드 검증 증적의 원본파일이 일치하지 않습니다. 다시 검증해 주세요.",
        400,
      );
    }
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

    if (run.downloadTest?.responseReady) {
      if (run.downloadTest.fileId !== input.fileId) {
        throw new PayloadServiceError(
          "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
          "기존 다운로드 테스트 증적의 원본파일이 일치하지 않습니다.",
          400,
        );
      }
      return {
        fileId: run.downloadTest.fileId,
        testedAt: run.downloadTest.testedAt.toISOString(),
        created: false,
      };
    }

    const inserted = await tx.serviceValidationDownloadTest.createMany({
      data: [
        {
          runId: run.id,
          fileId: input.fileId,
          testedByUserId: input.userId,
          responseReady: true,
        },
      ],
      skipDuplicates: true,
    });

    const evidence = await tx.serviceValidationDownloadTest.findUnique({
      where: { runId: run.id },
    });
    if (!evidence?.responseReady) {
      throw new PayloadServiceError(
        "SERVICE_DOWNLOAD_TEST_REQUIRED",
        "다운로드 테스트 증적을 저장하지 못했습니다. 다시 시도해 주세요.",
        500,
      );
    }
    if (evidence.fileId !== input.fileId) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
        "기존 다운로드 테스트 증적의 원본파일이 일치하지 않습니다.",
        400,
      );
    }
    return {
      fileId: evidence.fileId,
      testedAt: evidence.testedAt.toISOString(),
      created: inserted.count === 1,
    };
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
