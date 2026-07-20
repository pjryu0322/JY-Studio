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
import {
  assertDownloadTestEvidenceReady,
  assertSharedApiMcpConfirmationEvidenceIfGrouped,
} from "@/lib/distribution/service-validation-evidence-asserts-helpers";

export type ServiceValidationSubmitSnapshotEntry = {
  status: string;
  runId: string;
  testedAt: string | null;
  providerConfirmationStatus: string;
  providerConfirmationId: string | null;
  confirmedAt: string | null;
};

type PreparationChannelRunContext = {
  run: Awaited<ReturnType<typeof findLatestServiceValidationRun>>;
  resultItemCount: number | null;
};

/** DB-only: latest run for the channel + its result-item count (API/MCP only). */
async function loadPreparationChannelRun(input: {
  versionId: string;
  channel: ServiceChannel;
}): Promise<PreparationChannelRunContext> {
  const run = await findLatestServiceValidationRun({
    versionId: input.versionId,
    channel: input.channel,
  });
  const resultItemCount =
    run && (input.channel === "API" || input.channel === "MCP")
      ? await prisma.serviceValidationResultItem.count({ where: { runId: run.id } })
      : null;
  return { run, resultItemCount };
}

/** Pure: current validity for a preparation-channel run (STALE when no run exists). */
function resolvePreparationChannelValidity(input: {
  run: PreparationChannelRunContext["run"];
  resultItemCount: number | null;
  channel: ServiceChannel;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): "CURRENT" | "STALE" {
  if (!input.run) return "STALE";
  return resolveRunCurrentValidity({
    run: input.run,
    bindingFingerprint: input.bindingFingerprint,
    bindingIndexGenerationId: input.bindingIndexGenerationId,
    resultItemCount: input.resultItemCount,
    expectedRankingPolicyVersion:
      input.channel === "API" || input.channel === "MCP" ? RETRIEVAL_RANKING_POLICY_VERSION : null,
  });
}

/** Pure: throws unless the run PASSed and is CURRENT. */
function assertPreparationChannelRunPassCurrent(
  run: PreparationChannelRunContext["run"],
  validity: "CURRENT" | "STALE",
  channel: ServiceChannel,
): asserts run is NonNullable<PreparationChannelRunContext["run"]> {
  if (run && run.status === "PASS" && validity === "CURRENT") return;
  throw new PayloadServiceError(
    validity === "STALE" || run?.status === "STALE"
      ? "SERVICE_VALIDATION_STALE"
      : "SERVICE_VALIDATION_REQUIRED",
    validity === "STALE"
      ? "지식 데이터 또는 유통정보가 변경되어 서비스 검증을 다시 진행해야 합니다."
      : `${channel} 제공 방식의 검증이 필요합니다.`,
    400,
  );
}

/** Pure: throws when the run no longer matches the expected pipeline/document/index binding. */
function assertPreparationChannelRunMatchesBinding(input: {
  run: NonNullable<PreparationChannelRunContext["run"]>;
  packId: string;
  versionId: string;
  pipelineRunId?: string | null;
  normalizedDocumentId?: string | null;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): void {
  const { run } = input;
  const stale =
    run.packId !== input.packId ||
    run.versionId !== input.versionId ||
    (input.pipelineRunId && run.pipelineRunId !== input.pipelineRunId) ||
    (input.normalizedDocumentId && run.normalizedDocumentId !== input.normalizedDocumentId) ||
    (input.bindingFingerprint && run.fingerprint !== input.bindingFingerprint) ||
    (input.bindingIndexGenerationId && run.indexGenerationId !== input.bindingIndexGenerationId);
  if (stale) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "지식 데이터 또는 유통정보가 변경되어 서비스 검증을 다시 진행해야 합니다.",
      400,
    );
  }
}

/** Pure: throws when an API/MCP run has no retrieval result-item snapshot. */
function assertPreparationChannelResultsNonEmpty(
  channel: ServiceChannel,
  resultItemCount: number | null,
): void {
  if ((channel === "API" || channel === "MCP") && (resultItemCount ?? 0) < 1) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
      `${channel} 제공 방식의 검색 결과 Snapshot이 없습니다. 다시 검증해 주세요.`,
      400,
    );
  }
}

/** DB + pure: resolves the provider confirmation, or throws when it isn't CONFIRMED. */
async function loadPreparationChannelConfirmation(input: {
  runId: string;
  validity: "CURRENT" | "STALE";
  channel: ServiceChannel;
}) {
  const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: input.runId },
  });
  const confStatus = resolveConfirmationStatusDto({
    confirmationStatus: confirmation?.status,
    runValidity: input.validity,
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
  return { confirmation, confStatus };
}

async function assertPreparationChannelPassed(input: {
  packId: string;
  versionId: string;
  channel: ServiceChannel;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
  pipelineRunId?: string | null;
  normalizedDocumentId?: string | null;
}): Promise<PreparationValidationSnapshotEntry> {
  const { run, resultItemCount } = await loadPreparationChannelRun(input);
  const validity = resolvePreparationChannelValidity({ run, resultItemCount, ...input });
  assertPreparationChannelRunPassCurrent(run, validity, input.channel);
  assertPreparationChannelRunMatchesBinding({ run, ...input });
  assertPreparationChannelResultsNonEmpty(input.channel, resultItemCount);

  const downloadTestId =
    input.channel === "DOWNLOAD" ? await assertDownloadTestEvidenceReady(prisma, run.id) : null;

  const { confirmation, confStatus } = await loadPreparationChannelConfirmation({
    runId: run.id,
    validity,
    channel: input.channel,
  });

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
  await assertSharedApiMcpConfirmationEvidenceIfGrouped(prisma, {
    apiRunId: snapshot.API?.runId,
    mcpRunId: snapshot.MCP?.runId,
    apiConfirmationId: snapshot.API?.providerConfirmationId,
    mcpConfirmationId: snapshot.MCP?.providerConfirmationId,
  });
  return snapshot;
}

/** Pure: throws unless the selected-channel run PASSed and is CURRENT. */
function assertSelectedChannelRunPassCurrent(
  run: PreparationChannelRunContext["run"],
  validity: "CURRENT" | "STALE",
  channel: ServiceChannel,
): asserts run is NonNullable<PreparationChannelRunContext["run"]> {
  if (run && run.status === "PASS" && validity === "CURRENT") return;
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

/** Pure: throws when a selected API/MCP channel has no retrieval result-item snapshot. */
function assertSelectedChannelResultsNonEmpty(
  channel: ServiceChannel,
  resultItemCount: number | null,
): void {
  if ((channel === "API" || channel === "MCP") && (resultItemCount ?? 0) < 1) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
      `선택한 ${channel} 제공 방식의 검색 결과 Snapshot이 없습니다. 다시 검증해 주세요.`,
      400,
    );
  }
}

/** DB + pure: resolves the provider confirmation for a selected channel, or throws. */
async function loadSelectedChannelConfirmation(input: {
  runId: string;
  validity: "CURRENT" | "STALE";
  channel: ServiceChannel;
}) {
  const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: input.runId },
  });
  const confStatus = resolveConfirmationStatusDto({
    confirmationStatus: confirmation?.status,
    runValidity: input.validity,
  });
  if (confStatus !== "CONFIRMED" || !confirmation) {
    throw new PayloadServiceError(
      confStatus === "STALE"
        ? "SERVICE_VALIDATION_STALE"
        : confStatus === "REJECTED"
          ? "SERVICE_CONFIRMATION_REJECTED"
          : "SERVICE_CONFIRMATION_REQUIRED",
      confStatus === "REJECTED"
        ? `선택한 ${input.channel} 제공 방식의 검색 품질이 반려되었습니다. 다시 검증해 주세요.`
        : confStatus === "STALE"
          ? "지식 데이터 또는 유통정보가 변경되어 서비스 품질 확인을 다시 진행해야 합니다."
          : `선택한 ${input.channel} 제공 방식의 제공자 품질 확인이 필요합니다.`,
      400,
    );
  }
  return { confirmation, confStatus };
}

/** Full evidence gate for one selected distribution channel. */
async function assertSelectedChannelPassed(input: {
  versionId: string;
  channel: ServiceChannel;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): Promise<ServiceValidationSubmitSnapshotEntry> {
  const { channel } = input;
  const run = await findLatestServiceValidationRun({ versionId: input.versionId, channel });
  const resultItemCount =
    run && (channel === "API" || channel === "MCP")
      ? await prisma.serviceValidationResultItem.count({ where: { runId: run.id } })
      : null;
  const validity = resolvePreparationChannelValidity({ run, resultItemCount, ...input });
  assertSelectedChannelRunPassCurrent(run, validity, channel);
  assertSelectedChannelResultsNonEmpty(channel, resultItemCount);
  if (channel === "DOWNLOAD") {
    await assertDownloadTestEvidenceReady(prisma, run.id);
  }
  const { confirmation, confStatus } = await loadSelectedChannelConfirmation({
    runId: run.id,
    validity,
    channel,
  });
  return {
    status: run.status,
    runId: run.id,
    testedAt: run.testedAt?.toISOString() ?? null,
    providerConfirmationStatus: confStatus,
    providerConfirmationId: confirmation.id,
    confirmedAt: confirmation.confirmedAt.toISOString(),
  };
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
    snapshot[channel] = await assertSelectedChannelPassed({
      versionId: input.versionId,
      channel,
      bindingFingerprint: input.bindingFingerprint,
      bindingIndexGenerationId: input.bindingIndexGenerationId,
    });
  }
  await assertSharedApiMcpConfirmationEvidenceIfGrouped(prisma, {
    apiRunId: snapshot.API?.runId,
    mcpRunId: snapshot.MCP?.runId,
    apiConfirmationId: snapshot.API?.providerConfirmationId,
    mcpConfirmationId: snapshot.MCP?.providerConfirmationId,
  });
  return snapshot;
}

function currentEvidenceMismatchError(): PayloadServiceError {
  return new PayloadServiceError(
    "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
    "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
    400,
  );
}

/** DB + pure: current distribution metadata, or throws if missing/service-ended. */
async function loadCurrentEvidenceDistribution(
  db: Prisma.TransactionClient,
  versionId: string,
): Promise<NonNullable<Awaited<ReturnType<typeof prisma.packDistributionMetadata.findUnique>>>> {
  const dist = await db.packDistributionMetadata.findUnique({ where: { versionId } });
  if (!dist) {
    throw new PayloadServiceError("INCOMPLETE", "유통정보가 없습니다.", 400);
  }
  if (isServiceEnded(dist.serviceEndsAt)) {
    throw new PayloadServiceError("SERVICE_ENDED", "서비스 종료일이 지나 서비스를 제공할 수 없습니다.", 400);
  }
  return dist;
}

type CurrentEvidenceDistribution = Awaited<ReturnType<typeof loadCurrentEvidenceDistribution>>;

/** Pure: throws when the snapshot's channel selection no longer matches the live distribution. */
function assertCurrentEvidenceChannelsMatch(
  dist: CurrentEvidenceDistribution,
  snapshot: DoclingBundleReviewSubmitSnapshot,
): void {
  const snapAllowApi = snapshot.allowApi !== false;
  const snapAllowMcp = snapshot.allowMcp !== false;
  const snapAllowDownload = snapshot.allowDownload !== false;
  if (
    snapAllowApi !== dist.allowApi ||
    snapAllowMcp !== dist.allowMcp ||
    snapAllowDownload !== dist.allowDownload
  ) {
    throw currentEvidenceMismatchError();
  }
  if (selectedServiceChannels(dist).length < 1) {
    throw new PayloadServiceError("SERVICE_CHANNEL_REQUIRED", "제공 방식을 한 개 이상 선택해 주세요.", 400);
  }
  const snapChannels = snapshot.distributionChannels;
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
}

type CurrentEvidenceBinding = NonNullable<Awaited<ReturnType<typeof loadBindingContext>>["binding"]>;
type CurrentEvidenceLatestRun = NonNullable<Awaited<ReturnType<typeof loadBindingContext>>["latest"]>;

/** DB + pure: the current pipeline binding, or throws when it's missing. */
async function loadCurrentEvidenceBinding(
  db: Prisma.TransactionClient,
  packId: string,
  versionId: string,
): Promise<{ binding: CurrentEvidenceBinding; latest: CurrentEvidenceLatestRun }> {
  const { binding, latest } = await loadBindingContext(packId, versionId, db);
  if (!binding || !latest) {
    throw currentEvidenceMismatchError();
  }
  return { binding, latest };
}

type CurrentEvidenceChannelRun = NonNullable<
  Awaited<ReturnType<Prisma.TransactionClient["serviceValidationRun"]["findUnique"]>>
>;

/** Pure: throws unless the run's pipeline/index/document binding still matches the snapshot. */
function assertCurrentEvidenceChannelRunBindingMatches(
  run: CurrentEvidenceChannelRun | null,
  input: {
    channel: ServiceChannel;
    packId: string;
    versionId: string;
    latest: CurrentEvidenceLatestRun;
    binding: CurrentEvidenceBinding;
    approvedGenerationId: string | null | undefined;
    snap: PreparationValidationSnapshotEntry;
  },
): asserts run is CurrentEvidenceChannelRun {
  const { snap } = input;
  const runTestedAt = run?.testedAt?.toISOString() ?? null;
  const snapshotTestedAt = snap.testedAt ?? null;
  const mismatched =
    !run ||
    run.packId !== input.packId ||
    run.versionId !== input.versionId ||
    run.channel !== input.channel ||
    run.status !== "PASS" ||
    run.pipelineRunId !== input.latest.id ||
    !run.indexGenerationId ||
    !run.searchIndexGenerationId ||
    run.indexGenerationId !== input.binding.indexGenerationId ||
    run.indexGenerationId !== input.approvedGenerationId ||
    run.searchIndexGenerationId !== input.approvedGenerationId ||
    run.indexGenerationId !== run.searchIndexGenerationId ||
    run.fingerprint !== input.binding.fingerprint ||
    run.normalizedDocumentId !== input.binding.normalizedDocumentId ||
    !runTestedAt ||
    !snapshotTestedAt ||
    runTestedAt !== snapshotTestedAt;
  if (mismatched || run.invalidatedAt) {
    throw currentEvidenceMismatchError();
  }
}

/** DB + pure: for API/MCP channels, throws unless the result-item snapshot still matches. */
async function assertCurrentEvidenceChannelResultEvidence(
  db: Prisma.TransactionClient,
  channel: ServiceChannel,
  run: CurrentEvidenceChannelRun,
  snap: PreparationValidationSnapshotEntry,
): Promise<void> {
  if (channel !== "API" && channel !== "MCP") return;
  if (!snap.resultFingerprint || !run.resultFingerprint || snap.resultFingerprint !== run.resultFingerprint) {
    throw currentEvidenceMismatchError();
  }
  const itemCount = await db.serviceValidationResultItem.count({ where: { runId: run.id } });
  if (itemCount < 1) {
    throw currentEvidenceMismatchError();
  }
}

/** DB + pure: for the DOWNLOAD channel, throws unless the download-test snapshot still matches. */
async function assertCurrentEvidenceChannelDownloadEvidence(
  db: Prisma.TransactionClient,
  channel: ServiceChannel,
  run: CurrentEvidenceChannelRun,
  snap: PreparationValidationSnapshotEntry,
): Promise<void> {
  if (channel !== "DOWNLOAD") return;
  if (!snap.downloadTestId) {
    throw currentEvidenceMismatchError();
  }
  const downloadTest = await db.serviceValidationDownloadTest.findUnique({ where: { runId: run.id } });
  if (
    !downloadTest ||
    downloadTest.id !== snap.downloadTestId ||
    downloadTest.runId !== run.id ||
    downloadTest.responseReady !== true
  ) {
    throw currentEvidenceMismatchError();
  }
}

/** DB + pure: throws unless the provider confirmation still matches the snapshot. */
async function assertCurrentEvidenceChannelConfirmationMatches(
  db: Prisma.TransactionClient,
  run: CurrentEvidenceChannelRun,
  snap: PreparationValidationSnapshotEntry,
): Promise<void> {
  if (!snap.providerConfirmationId || snap.providerConfirmationStatus !== "CONFIRMED" || !snap.confirmedAt) {
    throw currentEvidenceMismatchError();
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
    throw currentEvidenceMismatchError();
  }
}

/** Full re-check for one preparation channel's evidence against the submit snapshot. */
async function assertCurrentEvidenceChannelPassed(input: {
  db: Prisma.TransactionClient;
  channel: ServiceChannel;
  packId: string;
  versionId: string;
  latest: CurrentEvidenceLatestRun;
  binding: CurrentEvidenceBinding;
  approvedGenerationId: string | null | undefined;
  snap: PreparationValidationSnapshotEntry;
}): Promise<void> {
  const { db, channel, snap } = input;
  const run = await db.serviceValidationRun.findUnique({ where: { id: snap.runId } });
  assertCurrentEvidenceChannelRunBindingMatches(run, input);
  await assertCurrentEvidenceChannelResultEvidence(db, channel, run, snap);
  await assertCurrentEvidenceChannelDownloadEvidence(db, channel, run, snap);
  await assertCurrentEvidenceChannelConfirmationMatches(db, run, snap);
}

export async function assertCurrentServiceValidationEvidence(input: {
  /** When set (e.g. approval tx), all reads use this client so evidence is re-checked atomically. */
  client?: Prisma.TransactionClient | typeof prisma;
  packId: string;
  versionId: string;
  snapshot: DoclingBundleReviewSubmitSnapshot;
}): Promise<void> {
  const db = input.client ?? prisma;

  const dist = await loadCurrentEvidenceDistribution(db, input.versionId);
  assertCurrentEvidenceChannelsMatch(dist, input.snapshot);
  const { binding, latest } = await loadCurrentEvidenceBinding(db, input.packId, input.versionId);

  const approvedGenerationId =
    input.snapshot.searchIndexGenerationId ?? input.snapshot.indexGenerationId ?? binding.indexGenerationId;
  const snapValidation = input.snapshot.preparationValidation ?? input.snapshot.serviceValidation ?? {};

  for (const channel of SEARCH_VALIDATION_PREPARATION_CHANNELS) {
    const snap = snapValidation[channel];
    assertCompletePreparationValidationSnapshotEntry(channel, snap);
    await assertCurrentEvidenceChannelPassed({
      db,
      channel,
      packId: input.packId,
      versionId: input.versionId,
      latest,
      binding,
      approvedGenerationId,
      snap,
    });
  }

  await assertSharedApiMcpConfirmationEvidenceIfGrouped(db, {
    apiRunId: snapValidation.API?.runId,
    mcpRunId: snapValidation.MCP?.runId,
    apiConfirmationId: snapValidation.API?.providerConfirmationId,
    mcpConfirmationId: snapValidation.MCP?.providerConfirmationId,
  });
}
