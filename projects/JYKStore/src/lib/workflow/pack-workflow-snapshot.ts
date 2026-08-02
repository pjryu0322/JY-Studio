/**
 * PackWorkflowSnapshot — pure policy read-model over PackWorkflowFacts.
 * No DB / Prisma / fetch. UI and use-cases should prefer this over ad-hoc marker switches.
 */
import { PackStatus } from "@prisma/client";
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
import type { AdminQualityGateSnapshot } from "@/lib/workflow/admin-workflow-state";
import type {
  PackWorkflowFacts,
  PackWorkflowRuntimeSummary,
  StepSnapshot,
  WorkflowAction,
  WorkflowBlockingReason,
  WorkflowStepState,
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

function deriveReadyBlocked(state: WorkflowStepState): {
  ready: boolean;
  blocked: boolean;
} {
  return {
    ready: state === "AVAILABLE" || state === "IN_PROGRESS",
    blocked: state === "BLOCKED",
  };
}

function stepSnap(
  step: AdminWorkflowStep,
  state: WorkflowStepState,
  blockingReasons: WorkflowBlockingReason[] = [],
  availableActions: WorkflowAction[] = [],
): StepSnapshot {
  const { ready, blocked } = deriveReadyBlocked(state);
  return {
    step,
    state,
    label: ADMIN_WORKFLOW_STEP_LABELS[step],
    blockingReasons,
    availableActions,
    ready,
    blocked,
  };
}

/**
 * Resolve the admin "where should work happen" step from facts.
 * Provider review is never a rail step — it only gates publish actions.
 */
export function resolveCurrentAdminStep(facts: PackWorkflowFacts): AdminWorkflowStep {
  const workerZipPhase = facts.receipt.workerZipPhase;
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
  const workerZipPhase = facts.receipt.workerZipPhase;
  const quality = toQuality(facts);
  const serviceValidationPhase = facts.serviceValidation.phase;
  const providerReviewPhase = facts.providerReview.phase;

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

  if (facts.packStatus === PackStatus.PUBLISHED) {
    actions.push("UNPUBLISH");
  } else if (facts.publishing.recoveryMode === "RESTORE_EXISTING") {
    actions.push("RESTORE_EXISTING_REVISION");
  } else if (facts.publishing.recoveryMode === "PUBLISH_NEW_REVISION" && publishOk) {
    actions.push("PUBLISH_NEW_REVISION");
  } else if (publishOk && facts.packStatus === PackStatus.REVIEWING) {
    actions.push("PUBLISH_FIRST_REVISION");
    actions.push("REJECT_REVIEW");
  }

  return actions;
}

export function resolveBlockingReasons(facts: PackWorkflowFacts): WorkflowBlockingReason[] {
  const blockingReasons: WorkflowBlockingReason[] = [];

  if (!facts.knowledgeScope.finalized && facts.receipt.workerZipPhase === "ACCEPTED") {
    blockingReasons.push({
      code: "INVENTORY_NOT_FINALIZED",
      message: "지식화 대상 범위가 확정되지 않았습니다.",
      step: "knowledgeScope",
    });
  }
  if (facts.correction.openSupplement) {
    blockingReasons.push({
      code: "OPEN_SUPPLEMENT",
      message: "제공자 보완 요청이 열려 있습니다.",
      step: "correction",
    });
  }
  if (facts.correction.openCount > 0) {
    blockingReasons.push({
      code: "UNRESOLVED_CORRECTION",
      message: "미해결 보정 항목이 있습니다.",
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
  if (
    facts.receipt.workerZipPhase === "COMPLETED" &&
    facts.generation.completed &&
    facts.generation.blockerCount === 0 &&
    facts.generation.failCount === 0 &&
    !facts.correction.openSupplement &&
    facts.serviceValidation.phase !== "PASSED"
  ) {
    blockingReasons.push({
      code: "SERVICE_VALIDATION_REQUIRED",
      message: "서비스 검증이 필요합니다.",
      step: "serviceValidation",
    });
  }
  if (facts.serviceValidation.phase === "PASSED" && !facts.providerReview.confirmed) {
    blockingReasons.push({
      code: "PROVIDER_REVIEW_REQUIRED",
      message: "제공자 검토 확인이 필요합니다.",
      step: "providerReview",
    });
  }
  if (
    facts.providerReview.confirmed &&
    facts.providerReview.generationId &&
    facts.generation.generationId &&
    facts.providerReview.generationId !== facts.generation.generationId
  ) {
    blockingReasons.push({
      code: "PROVIDER_REVIEW_STALE",
      message: "제공자 검토가 현재 생성본과 일치하지 않습니다.",
      step: "providerReview",
    });
  }
  if (facts.publishing.recoveryMode === "BLOCKED" && facts.packStatus === PackStatus.DRAFT) {
    blockingReasons.push({
      code: "PUBLISH_RECOVERY_BLOCKED",
      message: "게시 복구 조건을 충족하지 않습니다.",
      step: "publish",
    });
  }

  return blockingReasons;
}

function resolveStepState(input: {
  step: AdminWorkflowStep;
  currentStep: AdminWorkflowStep;
  completed: boolean;
  enterable: boolean;
  warning?: boolean;
  blockedByReasons: boolean;
}): WorkflowStepState {
  if (input.blockedByReasons && !input.completed) return "BLOCKED";
  if (input.completed) return "COMPLETED";
  if (!input.enterable) return "NOT_STARTED";
  if (input.warning) return "WARNING";
  if (input.step === input.currentStep) return "IN_PROGRESS";
  return "AVAILABLE";
}

export function buildPackWorkflowSnapshot(facts: PackWorkflowFacts): PackWorkflowSnapshot {
  const currentStep = resolveCurrentAdminStep(facts);
  const availableActions = resolveAvailableActions(facts);
  const blockingReasons = resolveBlockingReasons(facts);
  const workerZipPhase = facts.receipt.workerZipPhase;
  const quality = toQuality(facts);
  const serviceValidationPhase = facts.serviceValidation.phase;
  const providerReviewPhase = facts.providerReview.phase;

  const reasonsFor = (step: AdminWorkflowStep | "providerReview") =>
    blockingReasons.filter((r) => r.step === step);
  const actionsFor = (...codes: WorkflowAction[]) =>
    availableActions.filter((a) => codes.includes(a));

  const receiptBlocked = !canEnterKnowledgeScope({ workerZipPhase }) && workerZipPhase === "NONE";
  const knowledgeEnterable = canEnterKnowledgeScope({ workerZipPhase });
  const generationEnterable = canEnterGeneration({ workerZipPhase });
  const correctionEnterable = canEnterCorrection({
    workerZipPhase,
    quality,
    openSupplement: facts.correction.openSupplement,
  });
  const serviceEnterable = canEnterServiceValidation({
    workerZipPhase,
    quality,
    openSupplement: facts.correction.openSupplement,
  });
  const publishEnterable = canPublish({
    serviceValidationPhase,
    providerReviewPhase,
    openSupplement: facts.correction.openSupplement,
  });

  return {
    packId: facts.packId,
    currentStep,
    blockingReasons,
    availableActions,
    receipt: stepSnap(
      "receipt",
      resolveStepState({
        step: "receipt",
        currentStep,
        completed: facts.receipt.accepted,
        enterable: true,
        blockedByReasons: receiptBlocked,
      }),
      reasonsFor("receipt"),
      actionsFor("ACCEPT_MATERIAL"),
    ),
    knowledgeScope: stepSnap(
      "knowledgeScope",
      resolveStepState({
        step: "knowledgeScope",
        currentStep,
        completed: facts.knowledgeScope.finalized,
        enterable: knowledgeEnterable,
        blockedByReasons: reasonsFor("knowledgeScope").length > 0,
      }),
      reasonsFor("knowledgeScope"),
      actionsFor("FINALIZE_SCOPE"),
    ),
    generation: stepSnap(
      "generation",
      resolveStepState({
        step: "generation",
        currentStep,
        completed: facts.generation.completed,
        enterable: generationEnterable && facts.knowledgeScope.finalized,
        warning: facts.generation.warningCount > 0 && facts.generation.failCount === 0,
        blockedByReasons: !generationEnterable,
      }),
      reasonsFor("generation"),
      actionsFor("START_GENERATION"),
    ),
    correction: stepSnap(
      "correction",
      resolveStepState({
        step: "correction",
        currentStep,
        completed:
          facts.correction.openCount === 0 &&
          !facts.correction.openSupplement &&
          facts.generation.blockerCount === 0 &&
          facts.generation.failCount === 0,
        enterable: correctionEnterable || facts.correction.openCount > 0,
        blockedByReasons: reasonsFor("correction").length > 0,
      }),
      reasonsFor("correction"),
      actionsFor("OPEN_CORRECTION"),
    ),
    serviceValidation: stepSnap(
      "serviceValidation",
      resolveStepState({
        step: "serviceValidation",
        currentStep,
        completed: facts.serviceValidation.phase === "PASSED",
        enterable: serviceEnterable,
        blockedByReasons: !serviceEnterable && currentStep === "serviceValidation",
      }),
      reasonsFor("serviceValidation"),
      actionsFor("RUN_SERVICE_VALIDATION"),
    ),
    publish: stepSnap(
      "publish",
      resolveStepState({
        step: "publish",
        currentStep,
        completed: facts.packStatus === PackStatus.PUBLISHED,
        enterable: publishEnterable || facts.packStatus === PackStatus.PUBLISHED,
        blockedByReasons: !publishEnterable && facts.packStatus !== PackStatus.PUBLISHED,
      }),
      [
        ...reasonsFor("publish"),
        ...reasonsFor("providerReview"),
      ],
      actionsFor(
        "PUBLISH_FIRST_REVISION",
        "RESTORE_EXISTING_REVISION",
        "PUBLISH_NEW_REVISION",
        "UNPUBLISH",
        "REJECT_REVIEW",
        "REQUEST_PROVIDER_REVIEW",
      ),
    ),
  };
}

export function toPackWorkflowRuntimeSummary(
  snapshot: PackWorkflowSnapshot,
): PackWorkflowRuntimeSummary {
  const current = (() => {
    switch (snapshot.currentStep) {
      case "receipt":
        return snapshot.receipt;
      case "knowledgeScope":
        return snapshot.knowledgeScope;
      case "generation":
        return snapshot.generation;
      case "correction":
        return snapshot.correction;
      case "serviceValidation":
        return snapshot.serviceValidation;
      case "publish":
        return snapshot.publish;
      default:
        return snapshot.receipt;
    }
  })();
  return {
    currentStep: snapshot.currentStep,
    stepState: current.state,
    availableActions: snapshot.availableActions,
    blockingReasons: snapshot.blockingReasons,
  };
}
