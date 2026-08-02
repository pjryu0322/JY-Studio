/**
 * Pure PackWorkflowFacts assembly from already-loaded runtime inputs (no Prisma).
 * Used by Publish Workbench / detail clients that already fetched markers & quality.
 */
import type { PackStatus } from "@prisma/client";
import type { PackReviewStatusValue } from "@/lib/pack-review-status";
import type {
  AdminProviderReviewPhase,
  AdminQualityGateSnapshot,
  AdminServiceValidationPhase,
  AdminWorkerZipPhase,
} from "@/lib/workflow/admin-workflow-state";
import type { PackWorkflowFacts } from "@/lib/workflow/pack-workflow-facts";
import {
  normalizePackReviewStatus,
  normalizePackStatus,
  normalizeProviderReviewPhase,
  normalizeServiceValidationPhase,
  normalizeWorkerZipPhase,
} from "@/lib/workflow/pack-workflow-facts-normalize";
import type { PublishRecoveryMode } from "@/lib/workflow/publish-recovery";

export type AssemblePackWorkflowFactsInput = {
  packId: string;
  packStatus: PackStatus | string;
  workerZipPhase: AdminWorkerZipPhase | string | null;
  knowledgeScopeFinalized?: boolean;
  inventoryId?: string | null;
  includedCount?: number;
  pendingCount?: number;
  sourceRevisionId?: string | null;
  workingCopyId?: string | null;
  generationId?: string | null;
  quality: AdminQualityGateSnapshot;
  openCorrectionCount?: number;
  openSupplement: boolean;
  serviceValidationPhase: AdminServiceValidationPhase | string | null;
  providerReviewPhase: AdminProviderReviewPhase | string | null;
  productionGenerationId?: string | null;
  preservedGenerationId?: string | null;
  packReviewStatus?: PackReviewStatusValue | string | null;
  recoveryMode?: PublishRecoveryMode | null;
};

export function assemblePackWorkflowFacts(
  input: AssemblePackWorkflowFactsInput,
): PackWorkflowFacts {
  const workerZipPhase = normalizeWorkerZipPhase(input.workerZipPhase);
  const providerPhase = normalizeProviderReviewPhase(input.providerReviewPhase);
  return {
    packId: input.packId,
    packStatus: normalizePackStatus(input.packStatus),
    receipt: {
      accepted:
        workerZipPhase === "ACCEPTED" ||
        workerZipPhase === "COMPLETED" ||
        workerZipPhase === "PROCESSING",
      workerZipPhase,
      sourceRevisionId: input.sourceRevisionId ?? null,
      workingCopyId: input.workingCopyId ?? null,
    },
    knowledgeScope: {
      inventoryId: input.inventoryId ?? null,
      finalized: Boolean(input.knowledgeScopeFinalized),
      includedCount: input.includedCount ?? 0,
      pendingCount: input.pendingCount ?? 0,
    },
    generation: {
      generationId: input.generationId ?? null,
      completed: input.quality.completed,
      blockerCount: input.quality.hasBlockers
        ? Math.max(1, input.quality.blockers.length)
        : 0,
      warningCount: input.quality.hasWarnings
        ? Math.max(1, input.quality.warnings.length)
        : 0,
      failCount: input.quality.failCount,
    },
    correction: {
      openCount: input.openCorrectionCount ?? 0,
      openSupplement: input.openSupplement,
    },
    serviceValidation: {
      phase: normalizeServiceValidationPhase(input.serviceValidationPhase),
      generationId: input.generationId ?? null,
    },
    providerReview: {
      phase: providerPhase,
      generationId: input.generationId ?? null,
      confirmed: providerPhase === "CONFIRMED",
    },
    publishing: {
      productionGenerationId: input.productionGenerationId ?? null,
      preservedGenerationId: input.preservedGenerationId ?? null,
      packReviewStatus: normalizePackReviewStatus(input.packReviewStatus ?? null),
      recoveryMode: input.recoveryMode ?? null,
    },
  };
}
