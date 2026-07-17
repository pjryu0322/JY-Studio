import { randomUUID } from "node:crypto";
import {
  PackStatus,
  ServiceValidationProviderConfirmationStatus,
  type ServiceValidationRun,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  DOWNLOAD_REJECTION_REASONS,
  RETRIEVAL_REJECTION_REASONS,
} from "@/lib/distribution/service-validation-confirmation-constants";
import {
  findLatestServiceValidationRun,
  requireOwnedDraftPackForServiceValidationRun,
  resolveRunCurrentValidity,
  loadOwnedPackForServiceValidationRead,
} from "@/lib/distribution/service-validation-service";
import { canShareProviderConfirmation } from "@/lib/distribution/service-validation-share";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";
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

async function loadBinding(packId: string) {
  const latest = await prisma.pipelineRun.findFirst({
    where: { packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER, status: "PASS" },
    orderBy: { startedAt: "desc" },
  });
  return { binding: parseKnowledgeRunBinding(latest?.summary), pipelineRunId: latest?.id ?? null };
}

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
  const { pack, version } = await requireOwnedDraftPackForServiceValidationRun(input);
  assertDraftEditable(pack.status);
  const run = await prisma.serviceValidationRun.findUnique({
    where: { id: input.runId },
    include: { confirmation: true, resultItems: { orderBy: { rank: "asc" } }, downloadTest: true },
  });
  if (!run || run.packId !== pack.packId || run.versionId !== version.id) {
    throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
  }
  if (run.confirmation) {
    throw new PayloadServiceError(
      "SERVICE_CONFIRMATION_ALREADY_RECORDED",
      "이미 품질 확인이 기록된 검증입니다. 다시 검증한 뒤 확인해 주세요.",
      409,
    );
  }
  const { binding } = await loadBinding(pack.packId);
  const validity = resolveRunCurrentValidity({
    run,
    bindingFingerprint: binding?.fingerprint,
    bindingIndexGenerationId: binding?.indexGenerationId,
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
  return { pack, version, run, binding };
}

async function resolveShareablePeer(run: ServiceValidationRun & {
  resultItems: Array<{
    rank: number;
    chunkId: string;
    sourceDocumentId: string;
    pageStart: number | null;
    pageEnd: number | null;
  }>;
}) {
  const peerChannel = run.channel === "API" ? "MCP" : run.channel === "MCP" ? "API" : null;
  if (!peerChannel) return null;
  const peer = await findLatestServiceValidationRun({
    versionId: run.versionId,
    channel: peerChannel,
  });
  if (!peer) return null;
  const peerConfirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: peer.id },
  });
  if (peerConfirmation) return null;
  const peerItems = await prisma.serviceValidationResultItem.findMany({
    where: { runId: peer.id },
    orderBy: { rank: "asc" },
  });
  const { binding, pipelineRunId } = await loadBinding(run.packId);
  const share = canShareProviderConfirmation({
    apiRun: run.channel === "API" ? run : peer,
    mcpRun: run.channel === "MCP" ? run : peer,
    apiResults: (run.channel === "API" ? run.resultItems : peerItems).map((i) => ({
      rank: i.rank,
      chunkId: i.chunkId,
      sourceDocumentId: i.sourceDocumentId,
      pageStart: i.pageStart,
      pageEnd: i.pageEnd,
    })),
    mcpResults: (run.channel === "MCP" ? run.resultItems : peerItems).map((i) => ({
      rank: i.rank,
      chunkId: i.chunkId,
      sourceDocumentId: i.sourceDocumentId,
      pageStart: i.pageStart,
      pageEnd: i.pageEnd,
    })),
    binding: {
      fingerprint: binding?.fingerprint,
      indexGenerationId: binding?.indexGenerationId,
      normalizedDocumentId: binding?.normalizedDocumentId,
      pipelineRunId,
    },
  });
  return share ? peer : null;
}

export async function confirmServiceValidationRun(input: {
  userId: string;
  clientId: string;
  packId: string;
  runId: string;
  retrieval?: ConfirmRetrievalInput;
  download?: ConfirmDownloadInput;
}): Promise<{ confirmationId: string; sharedGroupId: string | null; confirmedRunIds: string[] }> {
  const { run } = await requireOwnedRunnableRun(input);

  if (run.channel === "DOWNLOAD") {
    const d = input.download;
    if (!d?.fileNameConfirmed || !d.downloadOkConfirmed || !d.fileMatchConfirmed) {
      throw new PayloadServiceError(
        "SERVICE_CONFIRMATION_INCOMPLETE",
        "다운로드 확인 항목을 모두 체크해 주세요.",
        400,
      );
    }
    if (!run.downloadTest?.responseReady) {
      throw new PayloadServiceError(
        "SERVICE_DOWNLOAD_TEST_REQUIRED",
        "테스트 다운로드를 먼저 실행해 주세요.",
        400,
      );
    }
    const details = run.details && typeof run.details === "object" && !Array.isArray(run.details)
      ? (run.details as Record<string, unknown>)
      : null;
    const expectedFileId = typeof details?.fileId === "string" ? details.fileId : null;
    if (!expectedFileId || run.downloadTest.fileId !== expectedFileId) {
      throw new PayloadServiceError(
        "SERVICE_DOWNLOAD_TEST_REQUIRED",
        "테스트 다운로드 증적이 검증 결과와 일치하지 않습니다. 다시 검증해 주세요.",
        400,
      );
    }
    const row = await prisma.serviceValidationProviderConfirmation.create({
      data: {
        runId: run.id,
        status: ServiceValidationProviderConfirmationStatus.CONFIRMED,
        fileNameConfirmed: true,
        downloadOkConfirmed: true,
        fileMatchConfirmed: true,
        confirmedByUserId: input.userId,
      },
    });
    return { confirmationId: row.id, sharedGroupId: null, confirmedRunIds: [run.id] };
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

  const peer = await resolveShareablePeer(run);
  const sharedGroupId = peer ? newSharedGroupId() : null;
  const targets: ServiceValidationRun[] = peer ? [run, peer] : [run];

  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const target of targets) {
      rows.push(
        await tx.serviceValidationProviderConfirmation.create({
          data: {
            runId: target.id,
            status: ServiceValidationProviderConfirmationStatus.CONFIRMED,
            relevanceConfirmed: true,
            contentConfirmed: true,
            sourceConfirmed: true,
            isolationConfirmed: true,
            confirmedByUserId: input.userId,
            sharedConfirmationGroupId: sharedGroupId,
          },
        }),
      );
    }
    return rows;
  });

  return {
    confirmationId: created[0]!.id,
    sharedGroupId,
    confirmedRunIds: targets.map((t) => t.id),
  };
}

export async function rejectServiceValidationRun(input: {
  userId: string;
  clientId: string;
  packId: string;
  runId: string;
  rejectionReason: string;
  comment?: string | null;
}): Promise<{ confirmationId: string }> {
  const { run } = await requireOwnedRunnableRun(input);
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

  const peer = run.channel === "DOWNLOAD" ? null : await resolveShareablePeer(run);
  const sharedGroupId = peer ? newSharedGroupId() : null;
  const targets = peer ? [run, peer] : [run];

  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const target of targets) {
      rows.push(
        await tx.serviceValidationProviderConfirmation.create({
          data: {
            runId: target.id,
            status: ServiceValidationProviderConfirmationStatus.REJECTED,
            rejectionReason: reason,
            comment,
            confirmedByUserId: input.userId,
            sharedConfirmationGroupId: sharedGroupId,
          },
        }),
      );
    }
    return rows;
  });

  return { confirmationId: created[0]!.id };
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

export async function recordDownloadTestEvidence(input: {
  userId: string;
  clientId: string;
  packId: string;
  runId: string;
}): Promise<{ fileId: string; testedAt: string }> {
  const { pack, version } = await loadOwnedPackForServiceValidationRead(input);
  const run = await prisma.serviceValidationRun.findUnique({ where: { id: input.runId } });
  if (!run || run.packId !== pack.packId || run.versionId !== version.id) {
    throw new PayloadServiceError("NOT_FOUND", "검증 실행을 찾을 수 없습니다.", 404);
  }
  if (run.channel !== "DOWNLOAD" || run.status !== "PASS") {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_REQUIRED",
      "다운로드 검증이 완료된 실행에서만 테스트 다운로드할 수 있습니다.",
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
  const row = await prisma.serviceValidationDownloadTest.upsert({
    where: { runId: run.id },
    create: {
      runId: run.id,
      fileId,
      testedByUserId: input.userId,
      responseReady: true,
    },
    update: {
      fileId,
      testedByUserId: input.userId,
      testedAt: new Date(),
      responseReady: true,
    },
  });
  return { fileId: row.fileId, testedAt: row.testedAt.toISOString() };
}
