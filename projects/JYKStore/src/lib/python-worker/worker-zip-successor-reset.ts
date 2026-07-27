/**
 * After Worker ZIP knowledge generation (or regeneration) reaches READY,
 * clear successor artifacts so prior quality / confirm evidence cannot be reused.
 *
 * No schema changes: delete append-only quality rows for the version, reset
 * SourceDocument.validationStatus, invalidate service validations, and retire
 * Store provider-review / service-validation markers that depended on old data.
 */
import type { Prisma } from "@prisma/client";
import { markServiceValidationsStaleForVersion } from "@/lib/distribution/mark-service-validations-stale";
import { prisma } from "@/lib/prisma";
import { WORKER_ZIP_SOURCE_LEGACY_TYPE } from "@/lib/python-worker/worker-source-document-service";
import {
  STORE_PROVIDER_REVIEW_TRIGGER,
  STORE_SERVICE_VALIDATION_TRIGGER,
} from "@/lib/store-workflow-markers";

type PrismaClientLike = Prisma.TransactionClient | typeof prisma;

export type WorkerZipSuccessorResetResult = {
  sourceDocumentsReset: number;
  sourceValidationReportsDeleted: number;
  structureCoverageReportsDeleted: number;
  knowledgeQualityReportsDeleted: number;
  chunkQualityReportsDeleted: number;
  releaseGateRunsDeleted: number;
  retrievalEvaluationSetsDeleted: number;
  serviceValidationsInvalidated: number;
  providerReviewMarkersRetired: number;
  serviceValidationMarkersRetired: number;
};

const RETIRE_SUMMARY = "지식데이터 재생성으로 이전 상태를 초기화했습니다.";

/**
 * Reset quality + confirm successor state for a pack version after generation READY.
 * Safe to call when there is no prior quality data (deleteMany/updateMany of 0).
 */
export async function resetWorkerZipSuccessorStateAfterGeneration(input: {
  packId: string;
  versionId: string;
  prismaClient?: typeof prisma;
}): Promise<WorkerZipSuccessorResetResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const versionId = input.versionId.trim();

  const [
    sourceDocs,
    sourceValidation,
    structure,
    knowledge,
    chunk,
    releaseGate,
    retrievalSets,
  ] = await Promise.all([
    client.sourceDocument.updateMany({
      where: {
        versionId,
        legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
        validationStatus: { not: "NOT_CHECKED" },
      },
      data: {
        validationStatus: "NOT_CHECKED",
        validationSummary: null,
      },
    }),
    // Quality gates / confirm evidence read latest by packId — clear the whole pack.
    client.sourceValidationReport.deleteMany({ where: { packId } }),
    client.structureCoverageReport.deleteMany({ where: { packId } }),
    client.knowledgeQualityReport.deleteMany({ where: { packId } }),
    client.chunkQualityReport.deleteMany({ where: { packId } }),
    client.releaseGateRun.deleteMany({ where: { packId } }),
    client.retrievalEvaluationSet.deleteMany({ where: { packId } }),
  ]);

  // Touch remaining Worker sources so structure freshness sees SOURCE_CHANGED even
  // when they were already NOT_CHECKED (updateMany above skipped them).
  await client.sourceDocument.updateMany({
    where: {
      versionId,
      legacySourceType: WORKER_ZIP_SOURCE_LEGACY_TYPE,
    },
    data: { updatedAt: new Date() },
  });

  const serviceValidationsInvalidated = await markServiceValidationsStaleForVersion(
    versionId,
    client as PrismaClientLike,
  );

  const [providerReview, serviceValidation] = await Promise.all([
    client.pipelineRun.updateMany({
      where: {
        packId,
        triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
        status: { in: ["PENDING", "RUNNING", "PASS", "SKIPPED"] },
      },
      data: {
        status: "FAIL",
        finishedAt: new Date(),
        summary: RETIRE_SUMMARY,
      },
    }),
    client.pipelineRun.updateMany({
      where: {
        packId,
        triggerType: STORE_SERVICE_VALIDATION_TRIGGER,
        status: { in: ["PASS", "SKIPPED"] },
      },
      data: {
        status: "FAIL",
        finishedAt: new Date(),
        summary: RETIRE_SUMMARY,
      },
    }),
  ]);

  return {
    sourceDocumentsReset: sourceDocs.count,
    sourceValidationReportsDeleted: sourceValidation.count,
    structureCoverageReportsDeleted: structure.count,
    knowledgeQualityReportsDeleted: knowledge.count,
    chunkQualityReportsDeleted: chunk.count,
    releaseGateRunsDeleted: releaseGate.count,
    retrievalEvaluationSetsDeleted: retrievalSets.count,
    serviceValidationsInvalidated,
    providerReviewMarkersRetired: providerReview.count,
    serviceValidationMarkersRetired: serviceValidation.count,
  };
}
