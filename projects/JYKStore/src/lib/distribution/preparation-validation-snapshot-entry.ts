/**
 * P5.1.3: Require complete preparationValidation snapshot entries for V3 approval.
 */

import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";

export type PreparationValidationSnapshotEntry = {
  status: string;
  runId: string;
  testedAt: string | null;
  currentValidity: "CURRENT";
  providerConfirmationStatus: string;
  providerConfirmationId: string;
  confirmedAt: string;
  pipelineRunId: string | null;
  normalizedDocumentId: string | null;
  indexGenerationId: string | null;
  fingerprint: string | null;
  resultFingerprint?: string | null;
  downloadTestId?: string | null;
};

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type LoosePrepEntry = {
  status?: string | null;
  runId?: string | null;
  testedAt?: string | null;
  currentValidity?: string | null;
  providerConfirmationStatus?: string | null;
  providerConfirmationId?: string | null;
  confirmedAt?: string | null;
  pipelineRunId?: string | null;
  normalizedDocumentId?: string | null;
  indexGenerationId?: string | null;
  fingerprint?: string | null;
  resultFingerprint?: string | null;
  downloadTestId?: string | null;
};

/**
 * Asserts that a preparationValidation channel entry has every field required
 * for Snapshot V3 approval. Throws SERVICE_VALIDATION_EVIDENCE_MISMATCH on failure.
 */
export function assertCompletePreparationValidationSnapshotEntry(
  channel: ServiceChannel,
  entry: PreparationValidationSnapshotEntry | LoosePrepEntry | null | undefined,
): asserts entry is PreparationValidationSnapshotEntry {
  if (entry == null) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
      400,
    );
  }

  const ok =
    entry.status === "PASS" &&
    nonEmpty(entry.runId) &&
    nonEmpty(entry.testedAt) &&
    entry.currentValidity === "CURRENT" &&
    entry.providerConfirmationStatus === "CONFIRMED" &&
    nonEmpty(entry.providerConfirmationId) &&
    nonEmpty(entry.confirmedAt) &&
    nonEmpty(entry.pipelineRunId) &&
    nonEmpty(entry.normalizedDocumentId) &&
    nonEmpty(entry.indexGenerationId) &&
    nonEmpty(entry.fingerprint) &&
    (channel === "DOWNLOAD"
      ? nonEmpty(entry.downloadTestId)
      : channel === "API" || channel === "MCP"
        ? nonEmpty(entry.resultFingerprint)
        : true);

  if (!ok) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_EVIDENCE_MISMATCH",
      "서비스 검증 증적이 현재 지식 데이터와 일치하지 않습니다. 제공자가 검수요청을 회수한 뒤 다시 검증해야 합니다.",
      400,
    );
  }
}
