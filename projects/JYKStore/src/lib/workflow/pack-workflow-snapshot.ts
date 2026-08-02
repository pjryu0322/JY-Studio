/**
 * PackWorkflowSnapshot — pure policy read-model over PackWorkflowFacts.
 * No DB / Prisma / fetch. UI and use-cases should prefer this over ad-hoc marker switches.
 */
import {
  ADMIN_WORKFLOW_STEP_LABELS,
  type AdminWorkflowStep,
} from "@/lib/workflow/admin-workflow-steps";
import {
  canEnterCorrection,
  canEnterGeneration,
  canEnterKnowledgeScope,
  canEnterServiceValidation,
  canPublish,
  canRequestProviderReviewAfterServiceValidation,
} from "@/lib/workflow/admin-workflow-gates";
import type { AdminQualityGateSnapshot, AdminWorkerZipPhase } from "@/lib/workflow/admin-workflow-state";
import type {
  PackWorkflowFacts,
  StepSnapshot,
  WorkflowAction,
  WorkflowBlockingReason,
} from "@/lib/workflow/pack-workflow-facts";

export type PackWorkflowSnapshot = {
  packId: string;
  currentStep: AdminWorkflowStep;
  blockingReasons: WorkflowBlockingReason[];
  availableActions: WorkflowAction[];
  receipt: StepSnapshot;
  knowledgeScope: StepSnapshot;
  generation: StepSnapshot;
  correction: StepSnapshot;
  serviceValidation: StepSnapshot;
  publish: StepSnapshot;
};

function stepSnap(
  step: AdminWorkflowStep,
  ready: boolean,
  blocked: boolean,
): StepSnapshot {
  return {
    step,
    ready,
    blocked,
    label: ADMIN_WORKFLOW_STEP_LABELS[step],
  };
}

function toWorkerZipPhase(raw: string | null): AdminWorkerZipPhase {
  switch (raw) {
    case "REQUESTED":
    case "ACCEPTED":
    case "PROCESSING":
    case "COMPLETED":
    case "FAILED":
    case "REJECTED":
      return raw;
    default:
      return "NONE";
  }
}

function toQuality(facts: PackWorkflowFacts): AdminQualityGateSnapshot {
  return {
    completed: facts.generation.completed,
    hasBlockers: facts.generation.blockerCount > 0,
    failCount: facts.generation.failCount,
    hasWarnings: facts.generation.warningCount > 0,
    blockers: [],
    warnings: [],
  };
}

/**
 * Resolve the admin "where should work happen" step from facts.
 * Provider review is never a rail step — it only gates publish actions.
 */
export function resolveCurrentAdminStep(facts: PackWorkflowFacts): AdminWorkflowStep {
  const workerZipPhase = toWorkerZipPhase(facts.receipt.workerZipPhase);
  const quality = toQuality(facts);

  if (!canEnterKnowledgeScope({ workerZipPhase })) {
    return "receipt";
  }
  if (!facts.knowledgeScope.finalized && workerZipPhase === "ACCEPTED") {
    return "knowledgeScope";
  }
  if (
    canEnterCorrection({
      workerZipPhase,
      quality,
      openSupplement: facts.correction.openSupplement,
    })
  ) {
    return "correction";
  }
  if (
    !canEnterServiceValidation({
      workerZipPhase,
      quality,
      openSupplement: facts.correction.openSupplement,
    })
  ) {
    if (!canEnterGeneration({ workerZipPhase })) {
      return "receipt";
    }
    return facts.knowledgeScope.finalized || workerZipPhase !== "ACCEPTED"
      ? "generation"
      : "knowledgeScope";
  }
  if (facts.serviceValidation.phase !== "PASSED" || !facts.providerReview.confirmed) {
    if (facts.serviceValidation.phase !== "PASSED") return "serviceValidation";
    return "publish";
  }
  return "publish";
}

export function resolveAvailableActions(facts: PackWorkflowFacts): WorkflowAction[] {
  const actions: WorkflowAction[] = [];
  const workerZipPhase = toWorkerZipPhase(facts.receipt.workerZipPhase);
  const quality = toQuality(facts);
  const serviceValidationPhase =
    facts.serviceValidation.phase === "PASSED" ? "PASSED" : "NONE";
  const providerReviewPhase =
    facts.providerReview.phase === "REQUESTED" ||
    facts.providerReview.phase === "CONFIRMED" ||
    facts.providerReview.phase === "WITHDRAWN"
      ? facts.providerReview.phase
      : "NONE";

  if (workerZipPhase === "REQUESTED") actions.push("ACCEPT_MATERIAL");
  if (workerZipPhase === "ACCEPTED" && !facts.knowledgeScope.finalized) {
    actions.push("FINALIZE_SCOPE");
  }
  if (canEnterGeneration({ workerZipPhase }) && facts.knowledgeScope.finalized) {
    actions.push("START_GENERATION");
  }
  if (
    canEnterCorrection({
      workerZipPhase,
      quality,
      openSupplement: facts.correction.openSupplement,
    })
  ) {
    actions.push("OPEN_CORRECTION");
  }
  if (
    canEnterServiceValidation({
      workerZipPhase,
      quality,
      openSupplement: facts.correction.openSupplement,
    })
  ) {
    actions.push("RUN_SERVICE_VALIDATION");
  }
  if (
    canRequestProviderReviewAfterServiceValidation({
      serviceValidationPhase,
      providerReviewPhase,
      openSupplement: facts.correction.openSupplement,
      workerZipPhase,
      quality,
    })
  ) {
    actions.push("REQUEST_PROVIDER_REVIEW");
  }

  const publishOk = canPublish({
    serviceValidationPhase,
    providerReviewPhase,
    openSupplement: facts.correction.openSupplement,
  });

  if (facts.packStatus === "PUBLISHED") {
    actions.push("UNPUBLISH");
  } else if (facts.publishing.recoveryMode === "RESTORE_EXISTING") {
    actions.push("RESTORE_EXISTING_REVISION");
  } else if (facts.publishing.recoveryMode === "PUBLISH_NEW_REVISION" && publishOk) {
    actions.push("PUBLISH_NEW_REVISION");
  } else if (publishOk && facts.publishing.packReviewStatus === "REVIEWING") {
    actions.push("PUBLISH_FIRST_REVISION");
    actions.push("REJECT_REVIEW");
  }

  return actions;
}

export function buildPackWorkflowSnapshot(facts: PackWorkflowFacts): PackWorkflowSnapshot {
  const currentStep = resolveCurrentAdminStep(facts);
  const availableActions = resolveAvailableActions(facts);
  const blockingReasons: WorkflowBlockingReason[] = [];
  const workerZipPhase = toWorkerZipPhase(facts.receipt.workerZipPhase);
  const quality = toQuality(facts);
  const serviceValidationPhase =
    facts.serviceValidation.phase === "PASSED" ? "PASSED" : "NONE";
  const providerReviewPhase =
    facts.providerReview.phase === "REQUESTED" ||
    facts.providerReview.phase === "CONFIRMED" ||
    facts.providerReview.phase === "WITHDRAWN"
      ? facts.providerReview.phase
      : "NONE";

  if (facts.correction.openSupplement) {
    blockingReasons.push({
      code: "OPEN_SUPPLEMENT",
      message: "제공자 보완 요청이 열려 있습니다.",
      step: "correction",
    });
  }
  if (facts.generation.blockerCount > 0 || facts.generation.failCount > 0) {
    blockingReasons.push({
      code: "QUALITY_BLOCKERS",
      message: "생성 품질 차단 항목이 있습니다.",
      step: "correction",
    });
  }
  if (facts.serviceValidation.phase === "PASSED" && !facts.providerReview.confirmed) {
    blockingReasons.push({
      code: "PROVIDER_REVIEW_REQUIRED",
      message: "제공자 검토 확인이 필요합니다.",
      step: "providerReview",
    });
  }

  return {
    packId: facts.packId,
    currentStep,
    blockingReasons,
    availableActions,
    receipt: stepSnap("receipt", facts.receipt.accepted, false),
    knowledgeScope: stepSnap(
      "knowledgeScope",
      facts.knowledgeScope.finalized,
      !canEnterKnowledgeScope({ workerZipPhase }),
    ),
    generation: stepSnap(
      "generation",
      facts.generation.completed,
      !canEnterGeneration({ workerZipPhase }),
    ),
    correction: stepSnap(
      "correction",
      facts.correction.openCount === 0 && !facts.correction.openSupplement,
      false,
    ),
    serviceValidation: stepSnap(
      "serviceValidation",
      facts.serviceValidation.phase === "PASSED",
      !canEnterServiceValidation({
        workerZipPhase,
        quality,
        openSupplement: facts.correction.openSupplement,
      }),
    ),
    publish: stepSnap(
      "publish",
      facts.packStatus === "PUBLISHED",
      !canPublish({
        serviceValidationPhase,
        providerReviewPhase,
        openSupplement: facts.correction.openSupplement,
      }),
    ),
  };
}
