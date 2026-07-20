/**
 * Fail-closed assertions that re-check current service validation evidence
 * against the submit snapshot (e.g. at approval time).
 */
import type { Prisma } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  isServiceEnded,
  selectedServiceChannels,
  type ServiceChannel,
} from "@/lib/distribution/service-channel-policy";
import { prisma } from "@/lib/prisma";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";
import {
  assertCompletePreparationValidationSnapshotEntry,
  type PreparationValidationSnapshotEntry,
} from "@/lib/distribution/preparation-validation-snapshot-entry";
import { SEARCH_VALIDATION_PREPARATION_CHANNELS } from "@/lib/distribution/service-validation-policy";
import { loadBindingContext } from "@/lib/distribution/service-validation-queries";
import { assertSharedApiMcpConfirmationEvidenceIfGrouped } from "@/lib/distribution/service-validation-evidence-asserts-helpers";

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
