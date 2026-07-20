/**
 * Provider-facing service validation status: maps runs to provider DTOs.
 */
import { PackStatus, type ServiceValidationRun } from "@prisma/client";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import { toProviderResultItemDtos } from "@/lib/distribution/service-validation-result-snapshot";
import {
  canShareProviderConfirmation,
  isLegacySharedConfirmationMissingFingerprint,
} from "@/lib/distribution/service-validation-share";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";
import { OPEN_PACK_REVIEW_STATUSES } from "@/lib/pack-review-status";
import { prisma } from "@/lib/prisma";
import {
  asRecord,
  formatBytes,
  mimeLabel,
  rankingPolicyVersionFromDetails,
  resolveConfirmationStatusDto,
  resolveRunCurrentValidity,
  resolveSearchEvaluationValidity,
  resolveValidationLockReason,
  SEARCH_VALIDATION_PREPARATION_CHANNELS,
  type ServiceValidationChannelDto,
  type ServiceValidationStatusDto,
} from "@/lib/distribution/service-validation-policy";
import {
  findLatestServiceValidationRun,
  loadBindingContext,
  loadOwnedPackForServiceValidationRead,
  loadSuggestedQueries,
} from "@/lib/distribution/service-validation-queries";

export async function mapRunToProviderChannelDto(input: {
  channel: ServiceChannel;
  run: ServiceValidationRun | null;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
  canRunValidation: boolean;
  userNames: Map<string, string>;
}): Promise<ServiceValidationChannelDto> {
  const { channel, run, canRunValidation } = input;
  if (!run) {
    return {
      channel,
      selected: true,
      systemStatus: "PENDING",
      providerConfirmationStatus: "NOT_REVIEWED",
      currentValidity: null,
      runId: null,
      testedAt: null,
      query: null,
      resultCount: null,
      failureMessage: null,
      latencyMs: null,
      results: [],
      canRun: canRunValidation,
      canConfirm: false,
      canShareConfirmationWithPeer: false,
      downloadTestCompleted: false,
      downloadSummary: null,
      confirmation: null,
    };
  }

  const resultRows = await prisma.serviceValidationResultItem.findMany({
    where: { runId: run.id },
    orderBy: { rank: "asc" },
  });
  const downloadTest = await prisma.serviceValidationDownloadTest.findUnique({
    where: { runId: run.id },
  });

  const validity = resolveRunCurrentValidity({
    run,
    bindingFingerprint: input.bindingFingerprint,
    bindingIndexGenerationId: input.bindingIndexGenerationId,
    resultItemCount: channel === "DOWNLOAD" ? null : resultRows.length,
    expectedRankingPolicyVersion:
      channel === "API" || channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
  });
  let effectiveValidity = validity;
  let legacyFingerprintMissing = false;
  const confirmationEarly = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: run.id },
  });
  if (confirmationEarly?.sharedConfirmationGroupId && (channel === "API" || channel === "MCP")) {
    const peers = await prisma.serviceValidationProviderConfirmation.findMany({
      where: { sharedConfirmationGroupId: confirmationEarly.sharedConfirmationGroupId },
      include: { run: { select: { channel: true, resultFingerprint: true } } },
    });
    const apiPeer = peers.find((p) => p.run.channel === "API")?.run;
    const mcpPeer = peers.find((p) => p.run.channel === "MCP")?.run;
    if (
      isLegacySharedConfirmationMissingFingerprint({
        sharedConfirmationGroupId: confirmationEarly.sharedConfirmationGroupId,
        apiResultFingerprint: apiPeer?.resultFingerprint,
        mcpResultFingerprint: mcpPeer?.resultFingerprint,
      })
    ) {
      effectiveValidity = "STALE";
      legacyFingerprintMissing = true;
    }
  }
  const systemStatus =
    run.status === "PASS" && effectiveValidity === "STALE" ? ("STALE" as const) : run.status;

  const confirmation = confirmationEarly;
  const providerConfirmationStatus = resolveConfirmationStatusDto({
    confirmationStatus: confirmation?.status,
    runValidity: effectiveValidity,
  });

  const results = toProviderResultItemDtos(resultRows);

  const details = asRecord(run.details);
  let downloadSummary: ServiceValidationChannelDto["downloadSummary"] = null;
  if (channel === "DOWNLOAD" && details) {
    const fileName = typeof details.fileName === "string" ? details.fileName : null;
    const fileSize = typeof details.fileSize === "number" ? details.fileSize : null;
    const mimeType = typeof details.mimeType === "string" ? details.mimeType : null;
    if (fileName) {
      const isRag = details.downloadMode === "RAG_EXPORT";
      downloadSummary = {
        fileName,
        fileSizeLabel: formatBytes(fileSize ?? 0),
        mimeLabel: isRag ? "ZIP" : mimeLabel(mimeType),
        integrityOk:
          (isRag
            ? details.checksumsValid === true && details.sourceTraceValid === true
            : details.storageVerified === true) && systemStatus === "PASS",
        downloadMode: isRag ? "RAG_EXPORT" : "LEGACY_ORIGINAL",
        schemaVersion:
          typeof details.ragExportSchemaVersion === "string"
            ? details.ragExportSchemaVersion
            : null,
        chunkCount: typeof details.chunkCount === "number" ? details.chunkCount : null,
        sourceCount: typeof details.sourceCount === "number" ? details.sourceCount : null,
        manifestValid: details.manifestValid === true,
        sourceTraceValid: details.sourceTraceValid === true,
        checksumsValid: details.checksumsValid === true,
        vectorsIncluded: details.vectorsIncluded === true,
        sourceFilesIncluded: details.sourceFilesIncluded === true,
      };
    }
  }

  const sharedWithChannels: ServiceChannel[] = [];
  if (confirmation?.sharedConfirmationGroupId) {
    const peers = await prisma.serviceValidationProviderConfirmation.findMany({
      where: { sharedConfirmationGroupId: confirmation.sharedConfirmationGroupId },
      include: { run: { select: { channel: true, id: true } } },
    });
    for (const p of peers) {
      if (p.run.id !== run.id) {
        sharedWithChannels.push(p.run.channel as ServiceChannel);
      }
    }
  }

  let canShareConfirmationWithPeer = false;
  if (
    (channel === "API" || channel === "MCP") &&
    systemStatus === "PASS" &&
    effectiveValidity === "CURRENT" &&
    providerConfirmationStatus === "NOT_REVIEWED" &&
    resultRows.length > 0
  ) {
    const peerChannel = channel === "API" ? "MCP" : "API";
    const peer = await findLatestServiceValidationRun({
      versionId: run.versionId,
      channel: peerChannel,
    });
    if (peer) {
      const peerConf = await prisma.serviceValidationProviderConfirmation.findUnique({
        where: { runId: peer.id },
      });
      if (!peerConf) {
        const peerItems = await prisma.serviceValidationResultItem.findMany({
          where: { runId: peer.id },
          orderBy: { rank: "asc" },
        });
        canShareConfirmationWithPeer = canShareProviderConfirmation({
          apiRun: channel === "API"
            ? { ...run, rankingPolicyVersion: rankingPolicyVersionFromDetails(run.details) }
            : { ...peer, rankingPolicyVersion: rankingPolicyVersionFromDetails(peer.details) },
          mcpRun: channel === "MCP"
            ? { ...run, rankingPolicyVersion: rankingPolicyVersionFromDetails(run.details) }
            : { ...peer, rankingPolicyVersion: rankingPolicyVersionFromDetails(peer.details) },
          apiResults: (channel === "API" ? resultRows : peerItems).map((i) => ({
            rank: i.rank,
            chunkId: i.chunkId,
            sourceDocumentId: i.sourceDocumentId,
            pageStart: i.pageStart,
            pageEnd: i.pageEnd,
          })),
          mcpResults: (channel === "MCP" ? resultRows : peerItems).map((i) => ({
            rank: i.rank,
            chunkId: i.chunkId,
            sourceDocumentId: i.sourceDocumentId,
            pageStart: i.pageStart,
            pageEnd: i.pageEnd,
          })),
          binding: {
            fingerprint: input.bindingFingerprint,
            indexGenerationId: input.bindingIndexGenerationId,
            pipelineRunId: run.pipelineRunId,
            normalizedDocumentId: run.normalizedDocumentId,
          },
        });
      }
    }
  }

  const downloadTestCompleted = Boolean(downloadTest?.responseReady);
  // DOWNLOAD: show confirm UI before download-test; API confirm still requires download evidence.
  const canConfirm =
    canRunValidation &&
    systemStatus === "PASS" &&
    effectiveValidity === "CURRENT" &&
    providerConfirmationStatus === "NOT_REVIEWED" &&
    (channel === "DOWNLOAD" ? true : resultRows.length > 0);

  return {
    channel,
    selected: true,
    systemStatus,
    providerConfirmationStatus,
    currentValidity: effectiveValidity,
    runId: run.id,
    testedAt: run.testedAt?.toISOString() ?? null,
    query: run.query,
    resultCount: run.resultCount,
    failureMessage: legacyFingerprintMissing
      ? "검색 결과 증적 형식이 변경되어 API와 MCP를 다시 검증해야 합니다."
      : run.failureMessage,
    latencyMs: run.latencyMs,
    results,
    canRun: canRunValidation,
    canConfirm,
    canShareConfirmationWithPeer,
    downloadTestCompleted,
    downloadSummary,
    confirmation: confirmation
      ? {
          status: providerConfirmationStatus,
          confirmedAt: confirmation.confirmedAt.toISOString(),
          confirmedByName: input.userNames.get(confirmation.confirmedByUserId) ?? "제공자",
          rejectionReason: confirmation.rejectionReason,
          comment: confirmation.comment,
          sharedWithChannels,
        }
      : null,
  };
}

export async function getServiceValidationStatus(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<ServiceValidationStatusDto> {
  const { pack, version } = await loadOwnedPackForServiceValidationRead(input);
  const { binding, latest, bindingState } = await loadBindingContext(pack.packId, version.id);

  // Search-validation prepares all delivery channels before the provider picks publish channels.
  const selected = new Set(SEARCH_VALIDATION_PREPARATION_CHANNELS);

  const openReview = await prisma.packReview.findFirst({
    where: {
      packId: pack.packId,
      status: { in: [...OPEN_PACK_REVIEW_STATUSES] },
    },
    select: { id: true },
  });

  let searchDataReady = false;
  if (binding && latest) {
    const [generationRow, evalStep] = await Promise.all([
      prisma.searchIndexGeneration.findUnique({
        where: { id: binding.indexGenerationId },
        select: {
          status: true,
          scope: true,
          versionId: true,
          pipelineRunId: true,
          normalizedDocumentId: true,
          fingerprint: true,
          chunkGenerationId: true,
        },
      }),
      prisma.pipelineStepLog.findFirst({
        where: { runId: latest.id, step: "SEARCH_EVALUATING" },
        select: { status: true, details: true },
      }),
    ]);
    const generationOk =
      generationRow?.status === "READY" &&
      generationRow.scope === "DRAFT" &&
      generationRow.versionId === version.id &&
      generationRow.pipelineRunId === latest.id &&
      generationRow.normalizedDocumentId === binding.normalizedDocumentId &&
      generationRow.fingerprint === binding.fingerprint &&
      generationRow.chunkGenerationId === binding.indexGenerationId;
    const evalOk = resolveSearchEvaluationValidity({
      status: evalStep?.status,
      details: evalStep?.details,
      expectedRankingPolicyVersion: RETRIEVAL_RANKING_POLICY_VERSION,
    }).current;
    searchDataReady = Boolean(generationOk && evalOk);
  }

  const canRunValidation =
    pack.status === PackStatus.DRAFT &&
    bindingState.status === "CURRENT" &&
    searchDataReady &&
    !openReview;
  const validationLockReason = resolveValidationLockReason({
    packStatus: pack.status,
    hasOpenReview: Boolean(openReview),
    bindingStatus: bindingState.status,
    searchDataReady,
  });
  const channels: ServiceValidationChannelDto[] = [];
  const confirmerIds = new Set<string>();

  // Prefetch runs + confirmation user ids
  const runsByChannel = new Map<ServiceChannel, ServiceValidationRun | null>();
  for (const channel of SEARCH_VALIDATION_PREPARATION_CHANNELS) {
    const run = await findLatestServiceValidationRun({ versionId: version.id, channel });
    runsByChannel.set(channel, run);
    if (run) {
      const conf = await prisma.serviceValidationProviderConfirmation.findUnique({
        where: { runId: run.id },
        select: { confirmedByUserId: true },
      });
      if (conf) confirmerIds.add(conf.confirmedByUserId);
    }
  }

  const users =
    confirmerIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: [...confirmerIds] } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const userNames = new Map(
    users.map((u) => [u.id, u.name?.trim() || u.email?.trim() || "제공자"]),
  );

  for (const channel of SEARCH_VALIDATION_PREPARATION_CHANNELS) {
    channels.push(
      await mapRunToProviderChannelDto({
        channel,
        run: runsByChannel.get(channel) ?? null,
        bindingFingerprint: binding?.fingerprint,
        bindingIndexGenerationId: binding?.indexGenerationId,
        canRunValidation,
        userNames,
      }),
    );
  }

  const selectedChannels = channels.filter((c) => selected.has(c.channel));
  const allPreparationChannelsPassed =
    selectedChannels.length === SEARCH_VALIDATION_PREPARATION_CHANNELS.length &&
    selectedChannels.every(
      (c) =>
        c.systemStatus === "PASS" &&
        c.currentValidity === "CURRENT" &&
        c.providerConfirmationStatus === "CONFIRMED",
    );

  const suggestedQueries = await loadSuggestedQueries({
    versionId: version.id,
    indexGenerationId: binding?.indexGenerationId,
  });

  return {
    packId: pack.packId,
    versionId: version.id,
    packStatus: pack.status,
    canRunValidation,
    validationLockReason,
    channels,
    allPreparationChannelsPassed,
    allSelectedPassed: allPreparationChannelsPassed,
    suggestedQuery: suggestedQueries[0] ?? "주요 기능을 알려주세요",
    suggestedQueries,
  };
}
