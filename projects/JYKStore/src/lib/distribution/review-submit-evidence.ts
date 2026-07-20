import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";
import {
  EVIDENCE_DRIFT_MESSAGE,
  PREPARATION_CHANNELS,
  ReviewSubmitEvidenceError,
  type PrismaLike,
} from "@/lib/distribution/review-submit-evidence-policy";
import {
  loadActiveBundleMaterialsForSubmitEvidence,
  loadOwnedDraftPackForSubmitEvidence,
  loadPassPipelineForSubmitEvidence,
  loadSearchGenerationForSubmitEvidence,
} from "@/lib/distribution/review-submit-evidence-loaders";
import { assertReviewSubmitChannelEvidence } from "@/lib/distribution/review-submit-evidence-channel-checks";

export {
  assertRagExportDownloadEvidenceBinding,
  ReviewSubmitEvidenceError,
  type PrismaLike,
} from "@/lib/distribution/review-submit-evidence-policy";

/**
 * Re-validate the full review-submit binding inside the commit transaction (§7-§10).
 *
 * Re-reads pack ownership, active bundle/ND, pipeline run binding, and the three
 * preparation-channel validation runs, then compares each against the snapshot that
 * was built before the transaction. Throws {@link ReviewSubmitEvidenceError} on any drift.
 */
export async function assertReviewSubmitEvidenceInTx(
  client: PrismaLike,
  input: {
    packId: string;
    versionId: string;
    providerProfileId: string;
    snapshot: DoclingBundleReviewSubmitSnapshot;
  },
): Promise<void> {
  const { packId, versionId, snapshot } = input;

  await loadOwnedDraftPackForSubmitEvidence(client, {
    packId,
    providerProfileId: input.providerProfileId,
  });

  const { bundle, nd, sourceFile } = await loadActiveBundleMaterialsForSubmitEvidence(client, {
    versionId,
    snapshot,
  });

  const { passRun, binding } = await loadPassPipelineForSubmitEvidence(client, {
    packId,
    versionId,
    nd,
    bundleId: bundle.id,
    snapshot,
  });

  const generation = await loadSearchGenerationForSubmitEvidence(client, {
    packId,
    versionId,
    nd,
    passRunId: passRun.id,
    binding,
    snapshot,
  });

  // §10 preparation-channel evidence — compare each snapshot entry against the current run.
  const prep = snapshot.preparationValidation ?? null;
  if (!prep) {
    throw new ReviewSubmitEvidenceError("PREPARATION_MISSING", EVIDENCE_DRIFT_MESSAGE);
  }

  for (const channel of PREPARATION_CHANNELS) {
    const snap = prep[channel];
    if (!snap?.runId) {
      throw new ReviewSubmitEvidenceError("PREPARATION_MISSING", EVIDENCE_DRIFT_MESSAGE);
    }
    await assertReviewSubmitChannelEvidence({
      client,
      channel,
      versionId,
      packId,
      passRunId: passRun.id,
      ndId: nd.id,
      ndFingerprint: nd.fingerprint,
      bindingIndexGenerationId: binding.indexGenerationId,
      generationId: generation.id,
      snap,
      sourceFile,
    });
  }

  await assertReviewSubmitDistributionChannelsMatch(client, versionId, snapshot);
}

/** §14: distribution channels (and at-least-one-selected) must still match the snapshot. */
async function assertReviewSubmitDistributionChannelsMatch(
  client: PrismaLike,
  versionId: string,
  snapshot: DoclingBundleReviewSubmitSnapshot,
): Promise<void> {
  const dist = await client.packDistributionMetadata.findUnique({ where: { versionId } });
  if (!dist) {
    throw new ReviewSubmitEvidenceError("DISTRIBUTION_MISSING", "유통정보가 없습니다.");
  }
  const channels = snapshot.distributionChannels;
  if (
    channels &&
    (channels.allowApi !== dist.allowApi ||
      channels.allowMcp !== dist.allowMcp ||
      channels.allowDownload !== dist.allowDownload)
  ) {
    throw new ReviewSubmitEvidenceError("DISTRIBUTION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  if (!dist.allowApi && !dist.allowMcp && !dist.allowDownload) {
    throw new ReviewSubmitEvidenceError("SERVICE_CHANNEL_REQUIRED", "제공 방식을 한 개 이상 선택해 주세요.");
  }
}
