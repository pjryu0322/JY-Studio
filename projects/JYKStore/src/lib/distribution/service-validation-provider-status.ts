/**
 * Provider-facing service validation status: maps runs to provider DTOs.
 */
import { PackStatus, type ServiceValidationRun } from "@prisma/client";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import { toProviderResultItemDtos } from "@/lib/distribution/service-validation-result-snapshot";
import {
  canShareProviderConfirmation,
  resolveSharedConfirmationStaleOverride,
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
  type ProviderConfirmationStatusDto,
  type ServiceValidationChannelDto,
  type ServiceValidationStatusDto,
} from "@/lib/distribution/service-validation-policy";
import {
  findLatestServiceValidationRun,
  loadBindingContext,
  loadOwnedPackForServiceValidationRead,
  loadSharedConfirmationPeerFingerprints,
  loadSuggestedQueries,
} from "@/lib/distribution/service-validation-queries";

type ProviderConfirmationRow = NonNullable<
  Awaited<ReturnType<typeof prisma.serviceValidationProviderConfirmation.findUnique>>
>;

/** DB-only: result rows, download test, and confirmation for a single run. */
async function loadProviderChannelRunRecords(runId: string) {
  const [resultRows, downloadTest, confirmation] = await Promise.all([
    prisma.serviceValidationResultItem.findMany({
      where: { runId },
      orderBy: { rank: "asc" },
    }),
    prisma.serviceValidationDownloadTest.findUnique({ where: { runId } }),
    prisma.serviceValidationProviderConfirmation.findUnique({ where: { runId } }),
  ]);
  return { resultRows, downloadTest, confirmation };
}

/** DB + pure: apply the legacy shared-confirmation stale override to a run's validity. */
async function resolveProviderChannelEffectiveValidity(input: {
  channel: ServiceChannel;
  validity: "CURRENT" | "STALE";
  confirmation: ProviderConfirmationRow | null;
}): Promise<{ effectiveValidity: "CURRENT" | "STALE"; legacyFingerprintMissing: boolean }> {
  const sharedConfirmationGroupId = input.confirmation?.sharedConfirmationGroupId;
  if (!sharedConfirmationGroupId) {
    return { effectiveValidity: input.validity, legacyFingerprintMissing: false };
  }
  const peers = await loadSharedConfirmationPeerFingerprints(prisma, sharedConfirmationGroupId);
  const staleOverride = resolveSharedConfirmationStaleOverride({
    channel: input.channel,
    sharedConfirmationGroupId,
    apiResultFingerprint: peers.apiResultFingerprint,
    mcpResultFingerprint: peers.mcpResultFingerprint,
  });
  return {
    effectiveValidity: staleOverride ? "STALE" : input.validity,
    legacyFingerprintMissing: staleOverride,
  };
}

/** Pure: build the DOWNLOAD-channel summary DTO from run details, if present. */
function buildProviderDownloadSummary(
  details: Record<string, unknown> | null,
  systemStatus: string,
): ServiceValidationChannelDto["downloadSummary"] {
  if (!details) return null;
  const fileName = typeof details.fileName === "string" ? details.fileName : null;
  if (!fileName) return null;
  const fileSize = typeof details.fileSize === "number" ? details.fileSize : null;
  const mimeType = typeof details.mimeType === "string" ? details.mimeType : null;
  const isRag = details.downloadMode === "RAG_EXPORT";
  return {
    fileName,
    fileSizeLabel: formatBytes(fileSize ?? 0),
    mimeLabel: isRag ? "ZIP" : mimeLabel(mimeType),
    integrityOk:
      (isRag
        ? details.checksumsValid === true && details.sourceTraceValid === true
        : details.storageVerified === true) && systemStatus === "PASS",
    downloadMode: isRag ? "RAG_EXPORT" : "LEGACY_ORIGINAL",
    schemaVersion:
      typeof details.ragExportSchemaVersion === "string" ? details.ragExportSchemaVersion : null,
    chunkCount: typeof details.chunkCount === "number" ? details.chunkCount : null,
    sourceCount: typeof details.sourceCount === "number" ? details.sourceCount : null,
    manifestValid: details.manifestValid === true,
    sourceTraceValid: details.sourceTraceValid === true,
    checksumsValid: details.checksumsValid === true,
    vectorsIncluded: details.vectorsIncluded === true,
    sourceFilesIncluded: details.sourceFilesIncluded === true,
  };
}

/** DB-only: channels (other than this run's own) sharing this run's confirmation group. */
async function loadProviderChannelSharedWithChannels(input: {
  sharedConfirmationGroupId: string | null | undefined;
  runId: string;
}): Promise<ServiceChannel[]> {
  if (!input.sharedConfirmationGroupId) return [];
  const peers = await prisma.serviceValidationProviderConfirmation.findMany({
    where: { sharedConfirmationGroupId: input.sharedConfirmationGroupId },
    include: { run: { select: { channel: true, id: true } } },
  });
  return peers
    .filter((p) => p.run.id !== input.runId)
    .map((p) => p.run.channel as ServiceChannel);
}

/** Pure: is this channel/run eligible to attempt sharing its confirmation with the peer channel? */
function isEligibleToShareConfirmationWithPeer(input: {
  channel: ServiceChannel;
  systemStatus: string;
  effectiveValidity: "CURRENT" | "STALE";
  providerConfirmationStatus: string;
  resultRowCount: number;
}): boolean {
  return (
    (input.channel === "API" || input.channel === "MCP") &&
    input.systemStatus === "PASS" &&
    input.effectiveValidity === "CURRENT" &&
    input.providerConfirmationStatus === "NOT_REVIEWED" &&
    input.resultRowCount > 0
  );
}

/** DB + pure: can this run's provider confirmation be shared with its unconfirmed peer channel? */
async function resolveCanShareConfirmationWithPeer(input: {
  channel: ServiceChannel;
  run: ServiceValidationRun;
  resultRows: Array<{
    rank: number;
    chunkId: string;
    sourceDocumentId: string;
    pageStart: number | null;
    pageEnd: number | null;
  }>;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): Promise<boolean> {
  const { channel, run, resultRows } = input;
  const peerChannel = channel === "API" ? "MCP" : "API";
  const peer = await findLatestServiceValidationRun({ versionId: run.versionId, channel: peerChannel });
  if (!peer) return false;

  const peerConf = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: peer.id },
  });
  if (peerConf) return false;

  const peerItems = await prisma.serviceValidationResultItem.findMany({
    where: { runId: peer.id },
    orderBy: { rank: "asc" },
  });
  const runWithPolicy = { ...run, rankingPolicyVersion: rankingPolicyVersionFromDetails(run.details) };
  const peerWithPolicy = {
    ...peer,
    rankingPolicyVersion: rankingPolicyVersionFromDetails(peer.details),
  };
  const toResultDto = (i: (typeof resultRows)[number]) => ({
    rank: i.rank,
    chunkId: i.chunkId,
    sourceDocumentId: i.sourceDocumentId,
    pageStart: i.pageStart,
    pageEnd: i.pageEnd,
  });

  return canShareProviderConfirmation({
    apiRun: channel === "API" ? runWithPolicy : peerWithPolicy,
    mcpRun: channel === "MCP" ? runWithPolicy : peerWithPolicy,
    apiResults: (channel === "API" ? resultRows : peerItems).map(toResultDto),
    mcpResults: (channel === "MCP" ? resultRows : peerItems).map(toResultDto),
    binding: {
      fingerprint: input.bindingFingerprint,
      indexGenerationId: input.bindingIndexGenerationId,
      pipelineRunId: run.pipelineRunId,
      normalizedDocumentId: run.normalizedDocumentId,
    },
  });
}

/** Pure: build the provider-facing confirmation DTO block. */
function buildProviderConfirmationDto(input: {
  confirmation: ProviderConfirmationRow | null;
  providerConfirmationStatus: ProviderConfirmationStatusDto;
  userNames: Map<string, string>;
  sharedWithChannels: ServiceChannel[];
}): ServiceValidationChannelDto["confirmation"] {
  const { confirmation } = input;
  if (!confirmation) return null;
  return {
    status: input.providerConfirmationStatus,
    confirmedAt: confirmation.confirmedAt.toISOString(),
    confirmedByName: input.userNames.get(confirmation.confirmedByUserId) ?? "제공자",
    rejectionReason: confirmation.rejectionReason,
    comment: confirmation.comment,
    sharedWithChannels: input.sharedWithChannels,
  };
}

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

  const { resultRows, downloadTest, confirmation } = await loadProviderChannelRunRecords(run.id);

  const validity = resolveRunCurrentValidity({
    run,
    bindingFingerprint: input.bindingFingerprint,
    bindingIndexGenerationId: input.bindingIndexGenerationId,
    resultItemCount: channel === "DOWNLOAD" ? null : resultRows.length,
    expectedRankingPolicyVersion:
      channel === "API" || channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
  });
  const { effectiveValidity, legacyFingerprintMissing } =
    await resolveProviderChannelEffectiveValidity({ channel, validity, confirmation });
  const systemStatus =
    run.status === "PASS" && effectiveValidity === "STALE" ? ("STALE" as const) : run.status;

  const providerConfirmationStatus = resolveConfirmationStatusDto({
    confirmationStatus: confirmation?.status,
    runValidity: effectiveValidity,
  });

  const results = toProviderResultItemDtos(resultRows);
  const downloadSummary =
    channel === "DOWNLOAD"
      ? buildProviderDownloadSummary(asRecord(run.details), systemStatus)
      : null;

  const sharedWithChannels = await loadProviderChannelSharedWithChannels({
    sharedConfirmationGroupId: confirmation?.sharedConfirmationGroupId,
    runId: run.id,
  });

  const canShareConfirmationWithPeer = isEligibleToShareConfirmationWithPeer({
    channel,
    systemStatus,
    effectiveValidity,
    providerConfirmationStatus,
    resultRowCount: resultRows.length,
  })
    ? await resolveCanShareConfirmationWithPeer({
        channel,
        run,
        resultRows,
        bindingFingerprint: input.bindingFingerprint,
        bindingIndexGenerationId: input.bindingIndexGenerationId,
      })
    : false;

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
    confirmation: buildProviderConfirmationDto({
      confirmation,
      providerConfirmationStatus,
      userNames: input.userNames,
      sharedWithChannels,
    }),
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
