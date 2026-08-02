/**
 * PackWorkflowFacts — typed facts collected from DB/services (loader may use Prisma).
 * Snapshot resolvers must treat this as immutable input and stay pure.
 * Legacy/DB string normalization happens only in the Facts loader / compatibility adapters.
 */
import type { PackStatus } from "@prisma/client";
import type { PackReviewStatusValue } from "@/lib/pack-review-status";
import type {
  AdminProviderReviewPhase,
  AdminServiceValidationPhase,
  AdminWorkerZipPhase,
} from "@/lib/workflow/admin-workflow-state";
import type { AdminWorkflowStep } from "@/lib/workflow/admin-workflow-steps";
import type { PublishRecoveryMode } from "@/lib/workflow/publish-recovery";

export type PackWorkflowFacts = {
  packId: string;
  packStatus: PackStatus;

  receipt: {
    accepted: boolean;
    workerZipPhase: AdminWorkerZipPhase;
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
    phase: AdminServiceValidationPhase;
    generationId: string | null;
  };

  providerReview: {
    phase: AdminProviderReviewPhase;
    generationId: string | null;
    confirmed: boolean;
  };

  publishing: {
    productionGenerationId: string | null;
    preservedGenerationId: string | null;
    packReviewStatus: PackReviewStatusValue | null;
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

export type WorkflowStepState =
  | "NOT_STARTED"
  | "AVAILABLE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "WARNING"
  | "BLOCKED";

export type StepSnapshot = {
  step: AdminWorkflowStep;
  state: WorkflowStepState;
  label: string;
  blockingReasons: WorkflowBlockingReason[];
  availableActions: WorkflowAction[];
  /** Derived: state is AVAILABLE or IN_PROGRESS (compat). */
  ready: boolean;
  /** Derived: state is BLOCKED (compat). */
  blocked: boolean;
};

/** Inbox / detail presentation slice derived from a Snapshot. */
export type PackWorkflowRuntimeSummary = {
  currentStep: AdminWorkflowStep;
  stepState: WorkflowStepState;
  availableActions: WorkflowAction[];
  blockingReasons: WorkflowBlockingReason[];
};
