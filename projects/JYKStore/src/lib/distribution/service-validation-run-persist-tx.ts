/**
 * The write-transaction body for `runServiceChannelValidation`: re-validates the
 * binding/evidence inside the lock, then persists the ServiceValidationRun (+
 * result items). Split into single-purpose `assert*Tx`/`load*Tx` steps so the
 * transaction body itself is a short, linear sequence.
 */
import { PackStatus, type Prisma, type ServiceValidationChannel, type ServiceValidationStatus } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import { buildRagExportPackage, isRagExportRunDetails } from "@/lib/exports/rag-export-builder";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import {
  resolveCurrentValidationBindingTx,
  type CurrentValidationBinding,
} from "@/lib/distribution/service-validation-binding";
import { assertNoOpenPackReview } from "@/lib/distribution/service-validation-queries";
import {
  assertSearchEvaluationCurrentForChannel,
  SEARCH_VALIDATION_PREPARATION_CHANNELS,
} from "@/lib/distribution/service-validation-policy";
import type { InternalValidationResultItem } from "@/lib/distribution/service-validation-result-snapshot";
import type { ChannelRunOutcome } from "@/lib/distribution/service-validation-run-execute";

type TxClient = Prisma.TransactionClient;

export type RunServiceValidationTxInput = {
  tx: TxClient;
  packId: string;
  providerProfileId: string;
  versionId: string;
  channel: ServiceChannel;
  userId: string;
  query: string | null;
  latestRunId: string;
  binding: CurrentValidationBinding;
  outcome: ChannelRunOutcome;
};

/** Row-locks the pack and asserts it is still the DRAFT pack/version this run started against. */
async function lockAndAssertDraftPackCurrentVersionInTx(input: RunServiceValidationTxInput): Promise<void> {
  await input.tx.$queryRaw`
    SELECT "id"
    FROM "KnowledgePack"
    WHERE "packId" = ${input.packId}
    FOR UPDATE
  `;
  const packInTx = await input.tx.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: input.providerProfileId, status: PackStatus.DRAFT },
    select: { packId: true },
  });
  const versionInTx = await input.tx.knowledgePackVersion.findFirst({
    where: { packId: input.packId },
    orderBy: latestKnowledgePackVersionOrderBy,
    select: { id: true },
  });
  if (!packInTx || versionInTx?.id !== input.versionId) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_NOT_EDITABLE",
      "지식팩 상태 또는 현재 버전이 변경되었습니다. 다시 시도해 주세요.",
      409,
    );
  }
}

/** Re-resolves the current knowledge binding inside the lock and asserts it hasn't drifted. */
async function assertBindingStillCurrentInTx(input: RunServiceValidationTxInput): Promise<CurrentValidationBinding> {
  const bindingInTx = await resolveCurrentValidationBindingTx(input.tx, {
    packId: input.packId,
    versionId: input.versionId,
    expectedPipelineRunId: input.latestRunId,
  });
  const drifted =
    bindingInTx.indexGenerationId !== input.binding.indexGenerationId ||
    bindingInTx.normalizedDocumentId !== input.binding.normalizedDocumentId ||
    bindingInTx.fingerprint !== input.binding.fingerprint;
  if (drifted) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "지식 데이터가 변경되어 서비스 검증을 다시 실행해야 합니다.",
      409,
    );
  }
  return bindingInTx;
}

/** Re-checks search-evaluation currency (API/MCP) and that the channel is still enabled. */
async function assertPreWriteChannelStillValidInTx(
  input: RunServiceValidationTxInput,
  bindingInTx: CurrentValidationBinding,
): Promise<void> {
  if (input.channel === "API" || input.channel === "MCP") {
    const evalStepInTx = await input.tx.pipelineStepLog.findFirst({
      where: { runId: bindingInTx.pipelineRunId, step: "SEARCH_EVALUATING" },
      select: { status: true, details: true },
    });
    assertSearchEvaluationCurrentForChannel({
      channel: input.channel,
      status: evalStepInTx?.status,
      details: evalStepInTx?.details,
    });
  }
  if (!SEARCH_VALIDATION_PREPARATION_CHANNELS.includes(input.channel)) {
    throw new PayloadServiceError("SERVICE_CHANNEL_DISABLED", "지원하지 않는 검증 채널입니다.", 409);
  }
}

/** For a PASSing API/MCP run, re-confirms the snapshot's source docs/files are still valid evidence. */
async function assertRetrievalEvidenceStillValidInTx(
  input: RunServiceValidationTxInput,
  bindingInTx: CurrentValidationBinding,
): Promise<void> {
  if (input.outcome.status !== "PASS" || (input.channel !== "API" && input.channel !== "MCP")) return;
  const safeItems = input.outcome.safeItems;
  const sourceDocumentIds = [...new Set(safeItems.map((item) => item.sourceDocumentId))];
  const sourceFileIds = [...new Set(safeItems.map((item) => item.sourceFileId).filter(Boolean))];
  const [sourceDocumentCount, sourceFileCount] = await Promise.all([
    input.tx.sourceDocument.count({ where: { id: { in: sourceDocumentIds }, versionId: input.versionId } }),
    input.tx.knowledgePackFile.count({
      where: {
        id: { in: sourceFileIds as string[] },
        versionId: input.versionId,
        role: "SOURCE_ORIGINAL",
        bundle: {
          id: bindingInTx.bundleId,
          isActive: true,
          deletedAt: null,
          storageStatus: "ACTIVE",
          status: "REVIEW_READY",
        },
      },
    }),
  ]);
  const evidenceIntact =
    sourceDocumentCount === sourceDocumentIds.length &&
    sourceFileIds.length >= 1 &&
    sourceFileCount === sourceFileIds.length;
  if (!evidenceIntact) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "검색 결과와 원문 파일 연결이 변경되었습니다. 다시 검증해 주세요.",
      409,
    );
  }
}

/** For a PASSing DOWNLOAD run, rebuilds the RAG Export package and confirms its fingerprint still matches. */
async function assertDownloadEvidenceStillValidInTx(
  input: RunServiceValidationTxInput,
  bindingInTx: CurrentValidationBinding,
): Promise<void> {
  if (input.outcome.status !== "PASS" || input.channel !== "DOWNLOAD") return;
  const details = input.outcome.details;
  if (!isRagExportRunDetails(details)) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "RAG Export 검증 증적이 올바르지 않습니다. 다시 검증해 주세요.",
      409,
    );
  }
  const expectedFp =
    details && typeof details === "object" && !Array.isArray(details)
      ? (details as Record<string, unknown>).exportFingerprint
      : null;
  const rebuilt = await buildRagExportPackage({
    packId: input.packId,
    versionId: input.versionId,
    expectedPipelineRunId: bindingInTx.pipelineRunId,
    expectedSearchIndexGenerationId: bindingInTx.indexGenerationId,
    expectedNormalizedDocumentId: bindingInTx.normalizedDocumentId,
    expectedFingerprint: bindingInTx.fingerprint,
    includeZipBytes: false,
  });
  if (typeof expectedFp !== "string" || rebuilt.exportFingerprint !== expectedFp) {
    throw new PayloadServiceError(
      "RAG_EXPORT_BINDING_STALE",
      "현재 검색데이터가 변경되었습니다. RAG Export 검증을 다시 실행해 주세요.",
      409,
    );
  }
}

/** P4.1: loads and validates the SearchIndexGeneration this run must be bound to. */
async function loadCurrentSearchGenerationRowInTx(input: RunServiceValidationTxInput) {
  const generationRow = await input.tx.searchIndexGeneration.findUnique({
    where: { id: input.binding.indexGenerationId },
  });
  if (!generationRow) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_REQUIRED",
      "검색 인덱스 세대가 없어 서비스 검증을 실행할 수 없습니다. 검색 데이터를 다시 생성해 주세요.",
      409,
    );
  }
  const isCurrent =
    generationRow.status === "READY" &&
    generationRow.scope === "DRAFT" &&
    generationRow.versionId === input.versionId &&
    generationRow.pipelineRunId === input.latestRunId &&
    generationRow.normalizedDocumentId === input.binding.normalizedDocumentId &&
    generationRow.fingerprint === input.binding.fingerprint &&
    generationRow.chunkGenerationId === input.binding.indexGenerationId;
  if (!isCurrent) {
    throw new PayloadServiceError(
      "SEARCH_GENERATION_NOT_CURRENT",
      "검색 인덱스 세대가 현재 자료와 일치하지 않거나 READY가 아닙니다. 다시 생성·검증해 주세요.",
      409,
    );
  }
  return generationRow;
}

/** Creates the ServiceValidationRun row for this attempt. */
async function createServiceValidationRunRowInTx(
  input: RunServiceValidationTxInput,
  generationId: string,
) {
  const { outcome } = input;
  return input.tx.serviceValidationRun.create({
    data: {
      packId: input.packId,
      versionId: input.versionId,
      channel: input.channel as ServiceValidationChannel,
      status: outcome.status,
      pipelineRunId: input.latestRunId,
      searchIndexGenerationId: generationId,
      indexGenerationId: generationId,
      normalizedDocumentId: input.binding.normalizedDocumentId,
      fingerprint: input.binding.fingerprint,
      resultFingerprint: outcome.resultFingerprint,
      testedAt: new Date(),
      testedByUserId: input.userId,
      query: input.query,
      resultCount: outcome.resultCount,
      topChunkId: outcome.topChunkId,
      sourceDocumentId: outcome.sourceDocumentId,
      page: outcome.page,
      latencyMs: outcome.latencyMs,
      failureCode: outcome.failureCode,
      failureMessage: outcome.failureMessage,
      details: outcome.details as Prisma.InputJsonValue,
    },
  });
}

/** For a PASSing API/MCP run, persists the retrieval result-item snapshot. */
async function persistSafeResultItemsInTx(
  tx: TxClient,
  runId: string,
  channel: ServiceChannel,
  status: ServiceValidationStatus,
  safeItems: InternalValidationResultItem[],
): Promise<void> {
  if (status !== "PASS" || (channel !== "API" && channel !== "MCP")) return;
  if (safeItems.length < 1) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
      "검색 결과 Snapshot을 저장할 수 없습니다. 다시 검증해 주세요.",
      500,
    );
  }
  await tx.serviceValidationResultItem.createMany({
    data: safeItems.map((item) => ({
      runId,
      rank: item.rank,
      chunkId: item.chunkId,
      title: item.title,
      snippet: item.snippet,
      score: item.score,
      sourceDocumentId: item.sourceDocumentId,
      sourceDocumentTitle: item.sourceDocumentTitle,
      sourceFileId: item.sourceFileId,
      pageStart: item.pageStart,
      pageEnd: item.pageEnd,
      sourceLocator: item.sourceLocator,
    })),
  });
}

/** Runs the full re-validate + persist sequence for a service-validation run inside its transaction. */
export async function persistServiceValidationRunInTx(
  input: RunServiceValidationTxInput,
) {
  await lockAndAssertDraftPackCurrentVersionInTx(input);
  await assertNoOpenPackReview(input.tx, input.packId);
  const bindingInTx = await assertBindingStillCurrentInTx(input);
  await assertPreWriteChannelStillValidInTx(input, bindingInTx);
  await assertRetrievalEvidenceStillValidInTx(input, bindingInTx);
  await assertDownloadEvidenceStillValidInTx(input, bindingInTx);
  const generationRow = await loadCurrentSearchGenerationRowInTx(input);
  const created = await createServiceValidationRunRowInTx(input, generationRow.id);
  await persistSafeResultItemsInTx(input.tx, created.id, input.channel, input.outcome.status, input.outcome.safeItems);
  return created;
}
