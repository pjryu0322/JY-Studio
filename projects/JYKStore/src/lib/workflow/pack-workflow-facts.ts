/**
 * PackWorkflowFacts — raw facts collected from DB/services (loader may use Prisma).
 * Snapshot resolvers must treat this as immutable input and stay pure.
 */
import type { PackStatus } from "@prisma/client";
import type { AdminWorkflowStep } from "@/lib/workflow/admin-workflow-steps";
import type { PublishRecoveryMode } from "@/lib/workflow/publish-recovery";

export type PackWorkflowFacts = {
  packId: string;
  packStatus: PackStatus | string;

  receipt: {
    accepted: boolean;
    workerZipPhase: string | null;
    sourceRevisionId: string | null;
    workingCopyId: string | null;
  };

  knowledgeScope: {
    inventoryId: string | null;
    finalized: boolean;
    includedCount: number;
    pendingCount: number;
  };

  generation: {
    generationId: string | null;
    completed: boolean;
    blockerCount: number;
    warningCount: number;
    failCount: number;
  };

  correction: {
    openCount: number;
    openSupplement: boolean;
  };

  serviceValidation: {
    phase: string | null;
    generationId: string | null;
  };

  providerReview: {
    phase: string | null;
    generationId: string | null;
    confirmed: boolean;
  };

  publishing: {
    productionGenerationId: string | null;
    preservedGenerationId: string | null;
    packReviewStatus: string | null;
    recoveryMode: PublishRecoveryMode | null;
  };
};

export type WorkflowAction =
  | "ACCEPT_MATERIAL"
  | "FINALIZE_SCOPE"
  | "START_GENERATION"
  | "OPEN_CORRECTION"
  | "RUN_SERVICE_VALIDATION"
  | "REQUEST_PROVIDER_REVIEW"
  | "PUBLISH_FIRST_REVISION"
  | "RESTORE_EXISTING_REVISION"
  | "PUBLISH_NEW_REVISION"
  | "UNPUBLISH"
  | "REJECT_REVIEW";

export type WorkflowBlockingReason = {
  code: string;
  message: string;
  step: AdminWorkflowStep | "providerReview";
};

export type StepSnapshot = {
  step: AdminWorkflowStep;
  ready: boolean;
  blocked: boolean;
  label: string;
};
