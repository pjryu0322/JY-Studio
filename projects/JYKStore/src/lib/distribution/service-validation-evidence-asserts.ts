/**
 * Fail-closed assertions that gate submit/approval on current, provider-confirmed
 * service validation evidence.
 */
import type { Prisma, PackDistributionMetadata } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  assertDistributionChannelsSelected,
  isServiceEnded,
  selectedServiceChannels,
  type ServiceChannel,
} from "@/lib/distribution/service-channel-policy";
import { prisma } from "@/lib/prisma";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";
import {
  assertSharedConfirmationEvidence,
} from "@/lib/distribution/service-validation-share";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import {
  assertCompletePreparationValidationSnapshotEntry,
  type PreparationValidationSnapshotEntry,
} from "@/lib/distribution/preparation-validation-snapshot-entry";
import {
  resolveConfirmationStatusDto,
  resolveRunCurrentValidity,
  SEARCH_VALIDATION_PREPARATION_CHANNELS,
} from "@/lib/distribution/service-validation-policy";
import {
  findLatestServiceValidationRun,
  loadBindingContext,
} from "@/lib/distribution/service-validation-queries";

export type ServiceValidationSubmitSnapshotEntry = {
  status: string;
  runId: string;
  testedAt: string | null;
  providerConfirmationStatus: string;
  providerConfirmationId: string | null;
  confirmedAt: string | null;
};

async function assertPreparationChannelPassed(input: {
  packId: string;
  versionId: string;
  channel: ServiceChannel;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
  pipelineRunId?: string | null;
  normalizedDocumentId?: string | null;
}): Promise<PreparationValidationSnapshotEntry> {
  const run = await findLatestServiceValidationRun({
    versionId: input.versionId,
    channel: input.channel,
  });
  const resultItemCount =
    run && (input.channel === "API" || input.channel === "MCP")
      ? await prisma.serviceValidationResultItem.count({ where: { runId: run.id } })
      : null;
  const validity = run
    ? resolveRunCurrentValidity({
        run,
        bindingFingerprint: input.bindingFingerprint,
        bindingIndexGenerationId: input.bindingIndexGenerationId,
        resultItemCount,
        expectedRankingPolicyVersion:
          input.channel === "API" || input.channel === "MCP"
            ? RETRIEVAL_RANKING_POLICY_VERSION
            : null,
      })
    : "STALE";
  if (!run || run.status !== "PASS" || validity !== "CURRENT") {
    throw new PayloadServiceError(
      validity === "STALE" || run?.status === "STALE"
        ? "SERVICE_VALIDATION_STALE"
        : "SERVICE_VALIDATION_REQUIRED",
      validity === "STALE"
        ? "지식 데이터 또는 유통정보가 변경되어 서비스 검증을 다시 진행해야 합니다."
        : `${input.channel} 제공 방식의 검증이 필요합니다.`,
      400,
    );
  }
  if (run.packId !== input.packId || run.versionId !== input.versionId) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "지식 데이터 또는 유통정보가 변경되어 서비스 검증을 다시 진행해야 합니다.",
      400,
    );
  }
  if (input.pipelineRunId && run.pipelineRunId !== input.pipelineRunId) {
    throw new PayloadServiceError("SERVICE_VALIDATION_STALE", "지식 데이터가 변경되어 서비스 검증을 다시 진행해야 합니다.", 400);
  }
  if (input.normalizedDocumentId && run.normalizedDocumentId !== input.normalizedDocumentId) {
    throw new PayloadServiceError("SERVICE_VALIDATION_STALE", "지식 데이터가 변경되어 서비스 검증을 다시 진행해야 합니다.", 400);
  }
  if (input.bindingFingerprint && run.fingerprint !== input.bindingFingerprint) {
    throw new PayloadServiceError("SERVICE_VALIDATION_STALE", "지식 데이터가 변경되어 서비스 검증을 다시 진행해야 합니다.", 400);
  }
  if (
    input.bindingIndexGenerationId &&
    run.indexGenerationId !== input.bindingIndexGenerationId
  ) {
    throw new PayloadServiceError("SERVICE_VALIDATION_STALE", "지식 데이터가 변경되어 서비스 검증을 다시 진행해야 합니다.", 400);
  }
  if ((input.channel === "API" || input.channel === "MCP") && (resultItemCount ?? 0) < 1) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
      `${input.channel} 제공 방식의 검색 결과 Snapshot이 없습니다. 다시 검증해 주세요.`,
      400,
    );
  }
  let downloadTestId: string | null = null;
  if (input.channel === "DOWNLOAD") {
    const downloadTest = await prisma.serviceValidationDownloadTest.findUnique({
      where: { runId: run.id },
    });
    if (!downloadTest?.responseReady) {
      throw new PayloadServiceError(
        "SERVICE_DOWNLOAD_TEST_REQUIRED",
        "다운로드 테스트 증적이 필요합니다. 테스트 다운로드 후 품질 확인해 주세요.",
        400,
      );
    }
    downloadTestId = downloadTest.id;
  }
  const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: run.id },
  });
  const confStatus = resolveConfirmationStatusDto({
    confirmationStatus: confirmation?.status,
    runValidity: validity,
  });
  if (confStatus !== "CONFIRMED" || !confirmation) {
    throw new PayloadServiceError(
      confStatus === "STALE"
        ? "SERVICE_VALIDATION_STALE"
        : confStatus === "REJECTED"
          ? "SERVICE_CONFIRMATION_REJECTED"
          : "SERVICE_CONFIRMATION_REQUIRED",
      confStatus === "REJECTED"
        ? `${input.channel} 제공 방식의 검색 품질이 반려되었습니다. 다시 검증해 주세요.`
        : confStatus === "STALE"
          ? "지식 데이터 또는 유통정보가 변경되어 서비스 품질 확인을 다시 진행해야 합니다."
          : `${input.channel} 제공 방식의 제공자 품질 확인이 필요합니다.`,
      400,
    );
  }
  return {
    status: run.status,
    runId: run.id,
    testedAt: run.testedAt?.toISOString() ?? null,
    currentValidity: "CURRENT",
    providerConfirmationStatus: confStatus,
    providerConfirmationId: confirmation.id,
    confirmedAt: confirmation.confirmedAt.toISOString(),
    pipelineRunId: run.pipelineRunId,
    normalizedDocumentId: run.normalizedDocumentId,
    indexGenerationId: run.indexGenerationId,
    fingerprint: run.fingerprint,
    resultFingerprint:
      input.channel === "API" || input.channel === "MCP" ? run.resultFingerprint : undefined,
    downloadTestId: downloadTestId ?? undefined,
  };
}

export async function assertPreparationServiceValidationsPassed(input: {
  packId: string;
  versionId: string;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
  pipelineRunId?: string | null;
  normalizedDocumentId?: string | null;
}): Promise<Record<ServiceChannel, PreparationValidationSnapshotEntry>> {
  const snapshot = {} as Record<ServiceChannel, PreparationValidationSnapshotEntry>;
  for (const channel of SEARCH_VALIDATION_PREPARATION_CHANNELS) {
    snapshot[channel] = await assertPreparationChannelPassed({
      packId: input.packId,
      versionId: input.versionId,
      channel,
      bindingFingerprint: input.bindingFingerprint,
      bindingIndexGenerationId: input.bindingIndexGenerationId,
      pipelineRunId: input.pipelineRunId,
      normalizedDocumentId: input.normalizedDocumentId,
    });
    assertCompletePreparationValidationSnapshotEntry(channel, snapshot[channel]);
  }
  if (snapshot.API && snapshot.MCP) {
    const apiRun = await prisma.serviceValidationRun.findUnique({
      where: { id: snapshot.API.runId },
    });
    const mcpRun = await prisma.serviceValidationRun.findUnique({
      where: { id: snapshot.MCP.runId },
    });
    const apiConf = await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { id: snapshot.API.providerConfirmationId },
    });
    const mcpConf = await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { id: snapshot.MCP.providerConfirmationId },
    });
    if (
      apiConf?.sharedConfirmationGroupId &&
      apiConf.sharedConfirmationGroupId === mcpConf?.sharedConfirmationGroupId
    ) {
      const [apiResults, mcpResults] = await Promise.all([
        prisma.serviceValidationResultItem.findMany({
          where: { runId: snapshot.API.runId },
          orderBy: { rank: "asc" },
        }),
        prisma.serviceValidationResultItem.findMany({
          where: { runId: snapshot.MCP.runId },
          orderBy: { rank: "asc" },
        }),
      ]);
      const asserted = assertSharedConfirmationEvidence({
        apiRun,
        mcpRun,
        apiResults: apiResults.map((i) => ({
          rank: i.rank,
          chunkId: i.chunkId,
          sourceDocumentId: i.sourceDocumentId,
          pageStart: i.pageStart,
          pageEnd: i.pageEnd,
        })),
        mcpResults: mcpResults.map((i) => ({
          rank: i.rank,
          chunkId: i.chunkId,
          sourceDocumentId: i.sourceDocumentId,
          pageStart: i.pageStart,
          pageEnd: i.pageEnd,
        })),
      });
      if (!asserted.ok) {
        throw new PayloadServiceError(asserted.code, asserted.message, 400);
      }
    }
  }
  return snapshot;
}

export async function assertSelectedServiceValidationsPassed(input: {
  versionId: string;
  distribution: Pick<PackDistributionMetadata, "allowApi" | "allowMcp" | "allowDownload">;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): Promise<Record<string, ServiceValidationSubmitSnapshotEntry>> {
  assertDistributionChannelsSelected(input.distribution);
  const selected = selectedServiceChannels(input.distribution);
  const snapshot: Record<string, ServiceValidationSubmitSnapshotEntry> = {};
  for (const channel of selected) {
    const run = await findLatestServiceValidationRun({ versionId: input.versionId, channel });
    const resultItemCount =
      run && (channel === "API" || channel === "MCP")
        ? await prisma.serviceValidationResultItem.count({ where: { runId: run.id } })
        : null;
    const validity = run
      ? resolveRunCurrentValidity({
          run,
          bindingFingerprint: input.bindingFingerprint,
          bindingIndexGenerationId: input.bindingIndexGenerationId,
          resultItemCount,
          expectedRankingPolicyVersion:
            channel === "API" || channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
        })
      : "STALE";
    if (!run || run.status !== "PASS" || validity !== "CURRENT") {
      throw new PayloadServiceError(
        validity === "STALE" || run?.status === "STALE"
          ? "SERVICE_VALIDATION_STALE"
          : "SERVICE_VALIDATION_REQUIRED",
        validity === "STALE"
          ? "지식 데이터 또는 유통정보가 변경되어 서비스 검증을 다시 진행해야 합니다."
          : `선택한 ${channel} 제공 방식의 검증이 필요합니다.`,
        400,
      );
    }
    if ((channel === "API" || channel === "MCP") && (resultItemCount ?? 0) < 1) {
      throw new PayloadServiceError(
        "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
        `선택한 ${channel} 제공 방식의 검색 결과 Snapshot이 없습니다. 다시 검증해 주세요.`,
        400,
      );
    }
    if (channel === "DOWNLOAD") {
      const downloadTest = await prisma.serviceValidationDownloadTest.findUnique({
        where: { runId: run.id },
      });
      if (!downloadTest?.responseReady) {
        throw new PayloadServiceError(
          "SERVICE_DOWNLOAD_TEST_REQUIRED",
          "다운로드 테스트 증적이 필요합니다. 테스트 다운로드 후 품질 확인해 주세요.",
          400,
        );
      }
    }
    const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { runId: run.id },
    });
    const confStatus = resolveConfirmationStatusDto({
      confirmationStatus: confirmation?.status,
      runValidity: validity,
    });
    if (confStatus !== "CONFIRMED") {
      throw new PayloadServiceError(
        confStatus === "STALE"
          ? "SERVICE_VALIDATION_STALE"
          : confStatus === "REJECTED"
            ? "SERVICE_CONFIRMATION_REJECTED"
            : "SERVICE_CONFIRMATION_REQUIRED",
        confStatus === "REJECTED"
          ? `선택한 ${channel} 제공 방식의 검색 품질이 반려되었습니다. 다시 검증해 주세요.`
          : confStatus === "STALE"
            ? "지식 데이터 또는 유통정보가 변경되어 서비스 품질 확인을 다시 진행해야 합니다."
            : `선택한 ${channel} 제공 방식의 제공자 품질 확인이 필요합니다.`,
        400,
      );
    }
    snapshot[channel] = {
      status: run.status,
      runId: run.id,
      testedAt: run.testedAt?.toISOString() ?? null,
      providerConfirmationStatus: confStatus,
      providerConfirmationId: confirmation!.id,
      confirmedAt: confirmation!.confirmedAt.toISOString(),
    };
  }
  // Shared confirmation fingerprint check when both API and MCP confirmed via same group
  if (snapshot.API && snapshot.MCP) {
    const apiRun = await prisma.serviceValidationRun.findUnique({
      where: { id: snapshot.API.runId },
    });
    const mcpRun = await prisma.serviceValidationRun.findUnique({
      where: { id: snapshot.MCP.runId },
    });
    const apiConf = await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { id: snapshot.API.providerConfirmationId! },
    });
    const mcpConf = await prisma.serviceValidationProviderConfirmation.findUnique({
      where: { id: snapshot.MCP.providerConfirmationId! },
    });
    if (
      apiConf?.sharedConfirmationGroupId &&
      apiConf.sharedConfirmationGroupId === mcpConf?.sharedConfirmationGroupId
    ) {
      const [apiResults, mcpResults] = await Promise.all([
        prisma.serviceValidationResultItem.findMany({
          where: { runId: snapshot.API.runId },
          orderBy: { rank: "asc" },
        }),
        prisma.serviceValidationResultItem.findMany({
          where: { runId: snapshot.MCP.runId },
          orderBy: { rank: "asc" },
        }),
      ]);
      const asserted = assertSharedConfirmationEvidence({
        apiRun,
        mcpRun,
        apiResults: apiResults.map((i) => ({
          rank: i.rank,
          chunkId: i.chunkId,
          sourceDocumentId: i.sourceDocumentId,
          pageStart: i.pageStart,
          pageEnd: i.pageEnd,
        })),
        mcpResults: mcpResults.map((i) => ({
          rank: i.rank,
          chunkId: i.chunkId,
          sourceDocumentId: i.sourceDocumentId,
          pageStart: i.pageStart,
          pageEnd: i.pageEnd,
        })),
      });
      if (!asserted.ok) {
        throw new PayloadServiceError(asserted.code, asserted.message, 400);
      }
    }
  }
  return snapshot;
}

export async function assertCurrentServiceValidationEvidence(input: {
  /** When set (e.g. approval tx), all reads use this client so evidence is re-checked atomically. */
  client?: Prisma.TransactionClient | typeof prisma;
  packId: string;
  versionId: string;
  snapshot: DoclingBundleReviewSubmitSnapshot;
}): Promise<void> {
  const db = input.client ?? prisma;
  const evidenceMismatch = () =>
    new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
      400,
    );

  const dist = await db.packDistributionMetadata.findUnique({
    where: { versionId: input.versionId },
  });
  if (!dist) {
    throw new PayloadServiceError("INCOMPLETE", "유통정보가 없습니다.", 400);
  }
  if (isServiceEnded(dist.serviceEndsAt)) {
    throw new PayloadServiceError(
      "SERVICE_ENDED",
      "서비스 종료일이 지나 서비스를 제공할 수 없습니다.",
      400,
    );
  }

  const selectedNow = selectedServiceChannels(dist);
  const snapAllowApi = input.snapshot.allowApi !== false;
  const snapAllowMcp = input.snapshot.allowMcp !== false;
  const snapAllowDownload = input.snapshot.allowDownload !== false;
  if (
    snapAllowApi !== dist.allowApi ||
    snapAllowMcp !== dist.allowMcp ||
    snapAllowDownload !== dist.allowDownload
  ) {
    throw evidenceMismatch();
  }

  if (selectedNow.length < 1) {
    throw new PayloadServiceError(
      "SERVICE_CHANNEL_REQUIRED",
      "제공 방식을 한 개 이상 선택해 주세요.",
      400,
    );
  }
  const snapChannels = input.snapshot.distributionChannels;
  if (
    snapChannels &&
    (snapChannels.allowApi !== dist.allowApi ||
      snapChannels.allowMcp !== dist.allowMcp ||
      snapChannels.allowDownload !== dist.allowDownload)
  ) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "서비스 검증 증적이 현재 유통 채널과 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
      400,
    );
  }

  const { binding, latest } = await loadBindingContext(input.packId, input.versionId, db);
  if (!binding || !latest) {
    throw evidenceMismatch();
  }

  const approvedGenerationId =
    input.snapshot.searchIndexGenerationId ??
    input.snapshot.indexGenerationId ??
    binding.indexGenerationId;

  const snapValidation =
    input.snapshot.preparationValidation ?? input.snapshot.serviceValidation ?? {};
  for (const channel of SEARCH_VALIDATION_PREPARATION_CHANNELS) {
    const snap = snapValidation[channel];
    assertCompletePreparationValidationSnapshotEntry(channel, snap);

    const run = await db.serviceValidationRun.findUnique({ where: { id: snap.runId } });
    const runTestedAt = run?.testedAt?.toISOString() ?? null;
    const snapshotTestedAt = snap.testedAt ?? null;
    if (
      !run ||
      run.packId !== input.packId ||
      run.versionId !== input.versionId ||
      run.channel !== channel ||
      run.status !== "PASS" ||
      run.pipelineRunId !== latest.id ||
      !run.indexGenerationId ||
      !run.searchIndexGenerationId ||
      run.indexGenerationId !== binding.indexGenerationId ||
      run.indexGenerationId !== approvedGenerationId ||
      run.searchIndexGenerationId !== approvedGenerationId ||
      run.indexGenerationId !== run.searchIndexGenerationId ||
      run.fingerprint !== binding.fingerprint ||
      run.normalizedDocumentId !== binding.normalizedDocumentId ||
      !runTestedAt ||
      !snapshotTestedAt ||
      runTestedAt !== snapshotTestedAt
    ) {
      throw evidenceMismatch();
    }
    if (run.invalidatedAt) {
      throw evidenceMismatch();
    }
    if (channel === "API" || channel === "MCP") {
      if (
        !snap.resultFingerprint ||
        !run.resultFingerprint ||
        snap.resultFingerprint !== run.resultFingerprint
      ) {
        throw evidenceMismatch();
      }
      const itemCount = await db.serviceValidationResultItem.count({
        where: { runId: run.id },
      });
      if (itemCount < 1) {
        throw evidenceMismatch();
      }
    }
    if (channel === "DOWNLOAD") {
      if (!snap.downloadTestId) {
        throw evidenceMismatch();
      }
      const downloadTest = await db.serviceValidationDownloadTest.findUnique({
        where: { runId: run.id },
      });
      if (
        !downloadTest ||
        downloadTest.id !== snap.downloadTestId ||
        downloadTest.runId !== run.id ||
        downloadTest.responseReady !== true
      ) {
        throw evidenceMismatch();
      }
    }

    if (
      !snap.providerConfirmationId ||
      snap.providerConfirmationStatus !== "CONFIRMED" ||
      !snap.confirmedAt
    ) {
      throw evidenceMismatch();
    }
    const confirmation = await db.serviceValidationProviderConfirmation.findUnique({
      where: { id: snap.providerConfirmationId },
    });
    if (
      !confirmation ||
      confirmation.runId !== run.id ||
      confirmation.status !== "CONFIRMED" ||
      !confirmation.confirmedAt ||
      confirmation.confirmedAt.toISOString() !== snap.confirmedAt
    ) {
      throw evidenceMismatch();
    }
  }

  const apiSnap = snapValidation.API;
  const mcpSnap = snapValidation.MCP;
  if (apiSnap?.runId && mcpSnap?.runId) {
    const apiRun = await db.serviceValidationRun.findUnique({ where: { id: apiSnap.runId } });
    const mcpRun = await db.serviceValidationRun.findUnique({ where: { id: mcpSnap.runId } });
    const apiConf = apiSnap.providerConfirmationId
      ? await db.serviceValidationProviderConfirmation.findUnique({
          where: { id: apiSnap.providerConfirmationId },
        })
      : null;
    const mcpConf = mcpSnap.providerConfirmationId
      ? await db.serviceValidationProviderConfirmation.findUnique({
          where: { id: mcpSnap.providerConfirmationId },
        })
      : null;
    if (
      apiConf?.sharedConfirmationGroupId &&
      apiConf.sharedConfirmationGroupId === mcpConf?.sharedConfirmationGroupId
    ) {
      const [apiResults, mcpResults] = await Promise.all([
        db.serviceValidationResultItem.findMany({
          where: { runId: apiSnap.runId },
          orderBy: { rank: "asc" },
        }),
        db.serviceValidationResultItem.findMany({
          where: { runId: mcpSnap.runId },
          orderBy: { rank: "asc" },
        }),
      ]);
      const asserted = assertSharedConfirmationEvidence({
        apiRun,
        mcpRun,
        apiResults: apiResults.map((i) => ({
          rank: i.rank,
          chunkId: i.chunkId,
          sourceDocumentId: i.sourceDocumentId,
          pageStart: i.pageStart,
          pageEnd: i.pageEnd,
        })),
        mcpResults: mcpResults.map((i) => ({
          rank: i.rank,
          chunkId: i.chunkId,
          sourceDocumentId: i.sourceDocumentId,
          pageStart: i.pageStart,
          pageEnd: i.pageEnd,
        })),
      });
      if (!asserted.ok) {
        throw new PayloadServiceError(asserted.code, asserted.message, 400);
      }
    }
  }
}
