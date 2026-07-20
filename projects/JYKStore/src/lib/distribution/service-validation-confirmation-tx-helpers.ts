/**
 * Shared transaction / ownership helpers for provider confirmation confirm+reject.
 * Pure matching helpers stay here; DB reads/writes stay in callers.
 */
import { randomUUID } from "node:crypto";
import {
  PackStatus,
  ServiceValidationProviderConfirmationStatus,
  type Prisma,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  resolveCurrentValidationBindingTx,
  type CurrentValidationBinding,
} from "@/lib/distribution/service-validation-binding";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import {
  rankingPolicyVersionFromDetails,
  requireOwnedDraftPackForServiceValidationRun,
  resolveRunCurrentValidity,
} from "@/lib/distribution/service-validation-service";
import { canShareProviderConfirmation } from "@/lib/distribution/service-validation-share";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import { prisma } from "@/lib/prisma";

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

export function newSharedGroupId(): string {
  return randomUUID().replace(/-/g, "");
}

export function assertDraftEditable(packStatus: PackStatus) {
  if (packStatus !== PackStatus.DRAFT) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_NOT_EDITABLE",
      "검수요청 전 초안 상태에서만 품질 확인을 변경할 수 있습니다.",
      403,
    );
  }
}

export async function requireOwnedRunnableRun(input: {
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
    expectedRankingPolicyVersion:
      run.channel === "API" || run.channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
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

export async function loadOwnedRunnableRunTx(
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

export async function resolveShareablePeerTx(
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
    apiRun:
      run.channel === "API"
        ? { ...run, rankingPolicyVersion: rankingPolicyVersionFromDetails(run.details) }
        : { ...peer, rankingPolicyVersion: rankingPolicyVersionFromDetails(peer.details) },
    mcpRun:
      run.channel === "MCP"
        ? { ...run, rankingPolicyVersion: rankingPolicyVersionFromDetails(run.details) }
        : { ...peer, rankingPolicyVersion: rankingPolicyVersionFromDetails(peer.details) },
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

/** Pure: does an existing confirmation row match the expected createMany input? */
export function confirmationMatches(
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

export async function createConfirmationsIdempotently(
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

/** Pure policy: DOWNLOAD confirm requires responseReady downloadTest matching details.fileId. */
export function assertDownloadConfirmEvidenceReady(input: {
  channel: string;
  downloadTest: { responseReady: boolean; fileId: string } | null | undefined;
  details: Record<string, unknown> | null;
}): void {
  if (input.channel !== "DOWNLOAD" || !input.downloadTest?.responseReady) {
    throw new PayloadServiceError(
      "SERVICE_DOWNLOAD_TEST_REQUIRED",
      "RAG Export를 먼저 다운로드해 주세요.",
      400,
    );
  }
  const expectedFileId =
    typeof input.details?.fileId === "string" ? input.details.fileId : null;
  if (!expectedFileId || input.downloadTest.fileId !== expectedFileId) {
    throw new PayloadServiceError(
      "SERVICE_DOWNLOAD_TEST_REQUIRED",
      "테스트 다운로드 증적이 검증 결과와 일치하지 않습니다. 다시 검증해 주세요.",
      400,
    );
  }
}
