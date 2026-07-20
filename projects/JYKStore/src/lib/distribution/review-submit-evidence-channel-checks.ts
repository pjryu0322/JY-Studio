/**
 * Per-channel evidence checks for assertReviewSubmitEvidenceInTx (§10).
 * Each channel's run must still match the pipeline/generation binding and the
 * preparation-validation snapshot entry that was captured before the transaction.
 */
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import {
  assertRagExportDownloadEvidenceBinding,
  EVIDENCE_DRIFT_MESSAGE,
  ReviewSubmitEvidenceError,
  type PrismaLike,
} from "@/lib/distribution/review-submit-evidence-policy";

type PreparationSnapshotEntryLike = {
  runId: string;
  testedAt?: string | null;
  pipelineRunId?: string | null;
  normalizedDocumentId?: string | null;
  indexGenerationId?: string | null;
  fingerprint?: string | null;
  providerConfirmationId?: string | null;
  resultFingerprint?: string | null;
  downloadTestId?: string | null;
};

type ChannelRunContext = {
  client: PrismaLike;
  channel: ServiceChannel;
  versionId: string;
  packId: string;
  passRunId: string;
  ndId: string;
  ndFingerprint: string | null;
  bindingIndexGenerationId: string;
  generationId: string;
  snap: PreparationSnapshotEntryLike;
};

/** DB + pure: latest run for the channel, re-checked against the current binding. */
async function loadReviewSubmitChannelRun(input: ChannelRunContext) {
  const { client, channel, versionId, snap } = input;
  const run = await client.serviceValidationRun.findFirst({
    where: { versionId, channel },
    orderBy: { createdAt: "desc" },
  });
  if (
    !run ||
    run.id !== snap.runId ||
    run.packId !== input.packId ||
    run.status !== "PASS" ||
    run.invalidatedAt != null ||
    run.pipelineRunId !== input.passRunId ||
    run.normalizedDocumentId !== input.ndId ||
    run.fingerprint !== input.ndFingerprint ||
    run.indexGenerationId !== input.bindingIndexGenerationId ||
    run.searchIndexGenerationId !== input.generationId
  ) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  if (
    (snap.pipelineRunId != null && snap.pipelineRunId !== run.pipelineRunId) ||
    (snap.normalizedDocumentId != null && snap.normalizedDocumentId !== run.normalizedDocumentId) ||
    (snap.indexGenerationId != null && snap.indexGenerationId !== run.indexGenerationId) ||
    (snap.fingerprint != null && snap.fingerprint !== run.fingerprint) ||
    (snap.testedAt != null && run.testedAt != null && run.testedAt.toISOString() !== snap.testedAt)
  ) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  return run;
}

type ReviewSubmitChannelRun = Awaited<ReturnType<typeof loadReviewSubmitChannelRun>>;

/** DB + pure: for API/MCP channels, the retrieval result snapshot must still match. */
async function assertReviewSubmitChannelResultEvidence(
  client: PrismaLike,
  channel: ServiceChannel,
  run: ReviewSubmitChannelRun,
  snap: PreparationSnapshotEntryLike,
): Promise<void> {
  if (channel !== "API" && channel !== "MCP") return;
  const itemCount = await client.serviceValidationResultItem.count({ where: { runId: run.id } });
  if (itemCount < 1) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  if (snap.resultFingerprint != null && run.resultFingerprint !== snap.resultFingerprint) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
}

/** DB + pure: for the DOWNLOAD channel, the RAG Export / legacy download evidence must match. */
async function assertReviewSubmitChannelDownloadEvidence(
  client: PrismaLike,
  channel: ServiceChannel,
  run: ReviewSubmitChannelRun,
  snap: PreparationSnapshotEntryLike,
  sourceFile: { id: string } | null,
): Promise<void> {
  if (channel !== "DOWNLOAD") return;
  const downloadTest = await client.serviceValidationDownloadTest.findUnique({
    where: { runId: run.id },
  });
  if (!downloadTest?.responseReady) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  if (snap.downloadTestId != null && downloadTest.id !== snap.downloadTestId) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  const runDetails =
    run.details && typeof run.details === "object" && !Array.isArray(run.details)
      ? (run.details as Record<string, unknown>)
      : null;
  // RAG Export fail-closed: downloadTest.fileId must equal exportFingerprint only (no fileId fallback).
  if (runDetails?.downloadMode === "RAG_EXPORT") {
    assertRagExportDownloadEvidenceBinding({ runDetails, downloadTestFileId: downloadTest.fileId });
  } else if (sourceFile && downloadTest.fileId !== sourceFile.id) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
}

/** DB + pure: the provider must still have a CONFIRMED confirmation for this run. */
async function assertReviewSubmitChannelConfirmation(
  client: PrismaLike,
  run: ReviewSubmitChannelRun,
  snap: PreparationSnapshotEntryLike,
): Promise<void> {
  const confirmation = await client.serviceValidationProviderConfirmation.findUnique({
    where: { runId: run.id },
  });
  if (!confirmation || confirmation.status !== "CONFIRMED") {
    throw new ReviewSubmitEvidenceError("CONFIRMATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  if (snap.providerConfirmationId != null && confirmation.id !== snap.providerConfirmationId) {
    throw new ReviewSubmitEvidenceError("CONFIRMATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
}

/** Full §10 evidence re-check for one preparation channel. */
export async function assertReviewSubmitChannelEvidence(
  input: ChannelRunContext & { sourceFile: { id: string } | null },
): Promise<void> {
  const { client, channel, snap, sourceFile } = input;
  const run = await loadReviewSubmitChannelRun(input);
  await assertReviewSubmitChannelResultEvidence(client, channel, run, snap);
  await assertReviewSubmitChannelDownloadEvidence(client, channel, run, snap, sourceFile);
  await assertReviewSubmitChannelConfirmation(client, run, snap);
}
