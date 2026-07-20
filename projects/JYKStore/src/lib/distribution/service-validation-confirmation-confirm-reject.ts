import {
  ServiceValidationProviderConfirmationStatus,
  type Prisma,
} from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  DOWNLOAD_REJECTION_REASONS,
  RETRIEVAL_REJECTION_REASONS,
} from "@/lib/distribution/service-validation-confirmation-constants";
import {
  assertDownloadConfirmEvidenceReady,
  createConfirmationsIdempotently,
  loadOwnedRunnableRunTx,
  newSharedGroupId,
  requireOwnedRunnableRun,
  resolveShareablePeerTx,
  type ConfirmDownloadInput,
  type ConfirmRetrievalInput,
} from "@/lib/distribution/service-validation-confirmation-tx-helpers";
import { prisma } from "@/lib/prisma";

const COMMENT_MAX = 1000;

export type { ConfirmDownloadInput, ConfirmRetrievalInput };

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
      const details =
        current.run.details &&
        typeof current.run.details === "object" &&
        !Array.isArray(current.run.details)
          ? (current.run.details as Record<string, unknown>)
          : null;
      assertDownloadConfirmEvidenceReady({
        channel: current.run.channel,
        downloadTest: current.run.downloadTest,
        details,
      });
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
