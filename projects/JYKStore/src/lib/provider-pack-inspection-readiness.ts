import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  buildProviderSubmitReadinessPlan,
  type ProviderSubmitReadinessPlan,
  type SubmitReadinessNextAction,
  type SubmitReadinessStep,
} from "@/lib/provider-submit-readiness-steps";
import { PROVIDER_PACK_GO_TO_REVIEW_TAB } from "@/lib/role-based-ux-copy";

export type InspectionStepId =
  | "structure_quality"
  | "chunk_quality"
  | "retrieval_case_generation"
  | "retrieval_quality";

export type InspectionStepStatus =
  | "not_started"
  | "ready"
  | "blocked"
  | "running"
  | "passed"
  | "warning"
  | "failed";

export type InspectionNextAction =
  | "RUN_STRUCTURE_QUALITY"
  | "RUN_CHUNK_QUALITY"
  | "GENERATE_RETRIEVAL_CASES"
  | "RUN_RETRIEVAL_EVALUATION"
  | "GO_TO_SUBMIT_REVIEW"
  | "WAIT_ADMIN_REVIEW"
  | "BLOCKED";

export type InspectionReadiness = {
  currentStepId: InspectionStepId | "completed";
  currentStepTitle: string;
  completedCount: number;
  totalCount: number;
  canSubmitReview: boolean;
  nextAction: InspectionNextAction;
  nextActionLabel: string;
  nextActionDescription: string;
  incompleteStepTitles: string[];
  steps: Array<{
    id: InspectionStepId;
    label: string;
    description: string;
    status: InspectionStepStatus;
    checklistStatus: SubmitReadinessStep["status"];
    blockerMessage?: string;
    primaryActionLabel?: string;
    actionKind?: SubmitReadinessNextAction;
  }>;
  plan: ProviderSubmitReadinessPlan;
};

const STEP_ID_BY_KEY: Record<
  Exclude<SubmitReadinessStep["key"], "submit_review">,
  InspectionStepId
> = {
  structure_quality: "structure_quality",
  chunk_quality: "chunk_quality",
  retrieval_cases: "retrieval_case_generation",
  retrieval_evaluation: "retrieval_quality",
};

function mapChecklistStatus(status: SubmitReadinessStep["status"]): InspectionStepStatus {
  switch (status) {
    case "completed":
      return "passed";
    case "current":
      return "ready";
    case "failed":
      return "failed";
    case "blocked":
      return "blocked";
    default:
      return "not_started";
  }
}

function mapNextAction(action: SubmitReadinessNextAction): InspectionNextAction {
  if (action === "SUBMIT_REVIEW") return "GO_TO_SUBMIT_REVIEW";
  return action;
}

export function buildProviderInspectionReadiness(input: {
  pack: ProviderPackDetailDto;
  sourceDocumentCount: number;
  knowledgeUnitDraftCount: number;
}): InspectionReadiness {
  const plan = buildProviderSubmitReadinessPlan(input);
  const qualitySteps = plan.steps.filter((step) => step.key !== "submit_review");
  const nextAction = mapNextAction(plan.nextAction);

  const steps = qualitySteps.map((step) => {
    const id = STEP_ID_BY_KEY[step.key as keyof typeof STEP_ID_BY_KEY];
    return {
      id,
      label: step.title,
      description: step.description,
      status: mapChecklistStatus(step.status),
      checklistStatus: step.status,
      blockerMessage: step.blockingReasons?.[0],
      primaryActionLabel: step.actionLabel,
      actionKind: step.actionKind,
    };
  });

  let currentStepId: InspectionStepId | "completed" = "completed";
  if (nextAction === "RUN_STRUCTURE_QUALITY") currentStepId = "structure_quality";
  else if (nextAction === "RUN_CHUNK_QUALITY") currentStepId = "chunk_quality";
  else if (nextAction === "GENERATE_RETRIEVAL_CASES") currentStepId = "retrieval_case_generation";
  else if (nextAction === "RUN_RETRIEVAL_EVALUATION") currentStepId = "retrieval_quality";
  else if (nextAction === "BLOCKED" || nextAction === "WAIT_ADMIN_REVIEW") {
    const current = steps.find((s) => s.checklistStatus === "current" || s.checklistStatus === "failed");
    currentStepId = current?.id ?? (plan.completedStepCount >= plan.totalStepCount ? "completed" : "structure_quality");
  }

  const nextActionLabel =
    nextAction === "GO_TO_SUBMIT_REVIEW" ? PROVIDER_PACK_GO_TO_REVIEW_TAB : plan.nextActionLabel;

  return {
    currentStepId,
    currentStepTitle:
      nextAction === "GO_TO_SUBMIT_REVIEW" ? "점검 완료: 검수요청 가능" : plan.currentStepTitle,
    completedCount: plan.completedStepCount,
    totalCount: plan.totalStepCount,
    canSubmitReview: plan.canSubmitReview,
    nextAction,
    nextActionLabel,
    nextActionDescription: plan.nextActionDescription,
    incompleteStepTitles: plan.incompleteStepTitles,
    steps,
    plan,
  };
}

export function isInspectionComplete(readiness: InspectionReadiness): boolean {
  return readiness.completedCount >= readiness.totalCount && readiness.canSubmitReview;
}
