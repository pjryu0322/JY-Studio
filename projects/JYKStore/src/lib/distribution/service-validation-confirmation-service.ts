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
  return parseKnowledgeRunBinding(latest?.summary);
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
    include: { confirmation: true },
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
  const binding = await loadBinding(pack.packId);
  const validity = resolveRunCurrentValidity({
    run,
    bindingFingerprint: binding?.fingerprint,
    bindingIndexGenerationId: binding?.indexGenerationId,
  });
  if (run.status !== "PASS" || validity !== "CURRENT") {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_REQUIRED",
      "시스템 검증이 완료된 현재 결과에서만 품질 확인할 수 있습니다.",
      400,
    );
  }
  return { pack, version, run, binding };
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

  // Shared API+MCP confirmation when both PASS CURRENT with same query.
  const peerChannel = run.channel === "API" ? "MCP" : run.channel === "MCP" ? "API" : null;
  const peer =
    peerChannel != null
      ? await findLatestServiceValidationRun({
          versionId: run.versionId,
          channel: peerChannel,
        })
      : null;
  const binding = await loadBinding(run.packId);
  const peerOk =
    peer &&
    peer.status === "PASS" &&
    resolveRunCurrentValidity({
      run: peer,
      bindingFingerprint: binding?.fingerprint,
      bindingIndexGenerationId: binding?.indexGenerationId,
    }) === "CURRENT" &&
    (peer.query ?? "") === (run.query ?? "") &&
    !(await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { runId: peer.id },
    }));

  const sharedGroupId = peerOk ? newSharedGroupId() : null;
  const targets: ServiceValidationRun[] = peerOk && peer ? [run, peer] : [run];

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

  const peerChannel = run.channel === "API" ? "MCP" : run.channel === "MCP" ? "API" : null;
  const peer =
    peerChannel != null
      ? await findLatestServiceValidationRun({
          versionId: run.versionId,
          channel: peerChannel,
        })
      : null;
  const binding = await loadBinding(run.packId);
  const peerOk =
    peer &&
    peer.status === "PASS" &&
    resolveRunCurrentValidity({
      run: peer,
      bindingFingerprint: binding?.fingerprint,
      bindingIndexGenerationId: binding?.indexGenerationId,
    }) === "CURRENT" &&
    (peer.query ?? "") === (run.query ?? "") &&
    !(await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { runId: peer.id },
    }));

  const sharedGroupId = peerOk ? newSharedGroupId() : null;
  const targets = peerOk && peer ? [run, peer] : [run];

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

export async function resolveProviderConfirmationStatus(input: {
  run: ServiceValidationRun;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): Promise<"NOT_REVIEWED" | "CONFIRMED" | "REJECTED" | "STALE"> {
  const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: input.run.id },
  });
  if (!confirmation) return "NOT_REVIEWED";
  const validity = resolveRunCurrentValidity({
    run: input.run,
    bindingFingerprint: input.bindingFingerprint,
    bindingIndexGenerationId: input.bindingIndexGenerationId,
  });
  if (validity === "STALE") return "STALE";
  if (confirmation.status === "CONFIRMED") return "CONFIRMED";
  if (confirmation.status === "REJECTED") return "REJECTED";
  return "NOT_REVIEWED";
}

/** Read helper used when pack is not DRAFT (admin/provider read-only). */
export async function getConfirmationForRun(runId: string) {
  return prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId },
    include: {
      // no user relation — resolve name separately if needed
    },
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
