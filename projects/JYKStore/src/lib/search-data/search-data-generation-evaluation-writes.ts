/**
 * Pipeline step / audit / activation writes for validateSearchData.
 */
import { activateDraftIndexGeneration } from "@/lib/docling-knowledge/docling-nd-knowledge-builder";
import {
  recordSearchDataValidationCompleted,
  recordSearchDataValidationFailed,
  recordSearchDataValidationStarted,
} from "@/lib/search-data/search-data-generation-events";
import {
  markSearchDataEvaluatingRunning,
  markSearchDataEvaluationNonPass,
  markSearchDataEvaluationPassed,
  markSearchDataEvaluationThrownFailure,
  markSearchDataReadyForReview,
} from "@/lib/search-data/search-data-generation-transitions";

export async function auditSearchDataValidationStarted(input: {
  packId: string;
  userId: string;
  indexGenerationId: string;
}): Promise<void> {
  await recordSearchDataValidationStarted({
    packId: input.packId,
    userId: input.userId,
    searchIndexGenerationId: input.indexGenerationId,
  });
}

export async function markSearchEvaluatingRunning(runId: string): Promise<void> {
  await markSearchDataEvaluatingRunning(runId);
}

export async function writeEvaluationNonPass(input: {
  packId: string;
  userId: string;
  runId: string;
  indexGenerationId: string;
  evaluationStatus: "FAIL" | "WARNING";
  failureCode: string | null | undefined;
  evaluationDetails: Record<string, unknown>;
}): Promise<void> {
  await markSearchDataEvaluationNonPass({
    runId: input.runId,
    evaluationStatus: input.evaluationStatus,
    evaluationDetails: input.evaluationDetails,
  });
  // Keep SearchIndexGeneration INDEXING — do not failDraftIndexGeneration.
  await recordSearchDataValidationFailed({
    packId: input.packId,
    userId: input.userId,
    searchIndexGenerationId: input.indexGenerationId,
    failureCode: input.failureCode,
  });
}

export async function writeEvaluationPassAndActivate(input: {
  packId: string;
  userId: string;
  runId: string;
  versionId: string;
  indexGenerationId: string;
  fingerprint: string;
  normalizedDocumentId: string;
  evaluationDetails: Record<string, unknown>;
}): Promise<void> {
  await activateDraftIndexGeneration({
    versionId: input.versionId,
    indexGenerationId: input.indexGenerationId,
  });

  await markSearchDataEvaluationPassed({
    runId: input.runId,
    evaluationDetails: input.evaluationDetails,
  });

  await markSearchDataReadyForReview({
    packId: input.packId,
    runId: input.runId,
    searchIndexGenerationId: input.indexGenerationId,
    fingerprint: input.fingerprint,
    versionId: input.versionId,
    normalizedDocumentId: input.normalizedDocumentId,
  });

  await recordSearchDataValidationCompleted({
    packId: input.packId,
    userId: input.userId,
    searchIndexGenerationId: input.indexGenerationId,
  });
}

export async function writeEvaluationThrownFailure(input: {
  packId: string;
  userId: string;
  runId: string;
  indexGenerationId: string;
  error: unknown;
}): Promise<void> {
  await markSearchDataEvaluationThrownFailure({
    runId: input.runId,
    error: input.error,
  });
  await recordSearchDataValidationFailed({
    packId: input.packId,
    userId: input.userId,
    searchIndexGenerationId: input.indexGenerationId,
  }).catch(() => undefined);
}
