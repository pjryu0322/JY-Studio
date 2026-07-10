import type { ProviderPackDetailDto } from "@/lib/provider-pack-dto";
import {
  buildProviderSubmitReadinessPlan,
  type ProviderSubmitReadinessPlan,
  type SubmitReadinessNextAction,
  type SubmitReadinessStep,
} from "@/lib/provider-submit-readiness-steps";
import {
  PROVIDER_PACK_GO_TO_DRAFT_SHORT,
  PROVIDER_PACK_GO_TO_INSPECTION_SHORT,
  PROVIDER_PACK_GO_TO_REVIEW_TAB,
  PROVIDER_PACK_GO_TO_SOURCE_TAB,
} from "@/lib/role-based-ux-copy";

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

export type ProviderInspectionUserState =
  | "auto_check_not_started"
  | "auto_check_running"
  | "review_ready"
  | "system_fix_available"
  | "source_fix_required"
  | "draft_fix_required"
  | "admin_review_waiting"
  | "published";

export type InspectionPrimaryActionKind =
  | "RUN_AUTO_PREPARE"
  | "REGENERATE_AND_CHECK"
  | "REPAIR_RETRIEVAL_DATA"
  | "GO_TO_SOURCE"
  | "GO_TO_DRAFT"
  | "GO_TO_REVIEW"
  | "NONE";

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
  userState: ProviderInspectionUserState;
  userTitle: string;
  userMessage: string;
  primaryActionLabel: string;
  primaryActionKind: InspectionPrimaryActionKind;
  passedTitles: string[];
  fixNeededTitles: string[];
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

function hasAnyQualityReport(pack: ProviderPackDetailDto): boolean {
  return Boolean(
    pack.structureQuality?.structureCoverage ||
      pack.chunkQuality?.report ||
      pack.retrievalEvaluation?.set ||
      pack.retrievalEvaluation?.latestRun,
  );
}

function resolveUserFacingState(input: {
  pack: ProviderPackDetailDto;
  sourceDocumentCount: number;
  knowledgeUnitDraftCount: number;
  plan: ProviderSubmitReadinessPlan;
  nextAction: InspectionNextAction;
}): Pick<
  InspectionReadiness,
  | "userState"
  | "userTitle"
  | "userMessage"
  | "primaryActionLabel"
  | "primaryActionKind"
  | "passedTitles"
  | "fixNeededTitles"
> {
  const { pack, sourceDocumentCount, knowledgeUnitDraftCount, plan, nextAction } = input;

  if (pack.status === "PUBLISHED" || pack.status === "VERIFIED") {
    return {
      userState: "published",
      userTitle: "공개 완료",
      userMessage: "운영자 승인이 완료된 지식팩입니다.",
      primaryActionLabel: "",
      primaryActionKind: "NONE",
      passedTitles: [],
      fixNeededTitles: [],
    };
  }

  if (pack.status === "REVIEWING" || nextAction === "WAIT_ADMIN_REVIEW") {
    return {
      userState: "admin_review_waiting",
      userTitle: "관리자 검토 대기",
      userMessage: "검수 요청이 접수되었습니다. 관리자 검토 결과를 기다려 주세요.",
      primaryActionLabel: "",
      primaryActionKind: "NONE",
      passedTitles: [],
      fixNeededTitles: [],
    };
  }

  if (sourceDocumentCount === 0) {
    return {
      userState: "source_fix_required",
      userTitle: "지식팩 자동 점검 결과: 자료 보완 필요",
      userMessage:
        "원천 문서가 없습니다. 자료등록 탭에서 문서를 등록한 뒤 다시 자동 생성해 주세요.",
      primaryActionLabel: PROVIDER_PACK_GO_TO_SOURCE_TAB,
      primaryActionKind: "GO_TO_SOURCE",
      passedTitles: [],
      fixNeededTitles: ["원천 문서 등록"],
    };
  }

  if (knowledgeUnitDraftCount === 0) {
    return {
      userState: "draft_fix_required",
      userTitle: "지식팩 자동 점검 결과: 초안 보완 필요",
      userMessage:
        "Knowledge Unit 후보가 없습니다. 초안 탭에서 후보를 생성하면 기본 점검이 자동으로 준비됩니다.",
      primaryActionLabel: PROVIDER_PACK_GO_TO_DRAFT_SHORT,
      primaryActionKind: "GO_TO_DRAFT",
      passedTitles: ["원천 문서 등록"],
      fixNeededTitles: ["Knowledge Unit 후보 생성"],
    };
  }

  const passedTitles: string[] = [];
  if (sourceDocumentCount > 0) passedTitles.push("원천 문서 검증");
  if (knowledgeUnitDraftCount > 0) passedTitles.push("Knowledge Unit 후보 생성");

  const qualitySteps = plan.steps.filter((s) => s.key !== "submit_review");
  for (const step of qualitySteps) {
    if (step.status === "completed") {
      if (step.key === "structure_quality") passedTitles.push("구조/품질 점검");
      if (step.key === "chunk_quality") {
        passedTitles.push("Chunk 자동 생성");
        passedTitles.push("청킹 품질 점검");
      }
      if (step.key === "retrieval_cases") passedTitles.push("검색 평가 케이스 생성");
      if (step.key === "retrieval_evaluation") passedTitles.push("검색 품질 평가");
    }
  }

  if (plan.canSubmitReview || nextAction === "GO_TO_SUBMIT_REVIEW") {
    return {
      userState: "review_ready",
      userTitle: "지식팩 자동 점검 완료",
      userMessage: "검수 요청에 필요한 기본 점검이 완료되었습니다.",
      primaryActionLabel: PROVIDER_PACK_GO_TO_REVIEW_TAB,
      primaryActionKind: "GO_TO_REVIEW",
      passedTitles,
      fixNeededTitles: [],
    };
  }

  const fixNeededTitles = plan.incompleteStepTitles.map((title) => {
    if (title === "검색 품질 평가") return "검색용 데이터 보완";
    if (title === "검색 평가 케이스 생성") return "검색 평가 케이스 재생성";
    if (title === "청킹 품질 점검") return "Chunk 자동 생성·점검";
    return title;
  });
  const started = hasAnyQualityReport(pack);
  const retrievalFailed =
    nextAction === "RUN_RETRIEVAL_EVALUATION" ||
    plan.steps.some((s) => s.key === "retrieval_evaluation" && s.status === "failed");
  const activeChunkHint =
    pack.chunkQuality?.report?.activeChunkCount != null
      ? `활성 Chunk ${pack.chunkQuality.report.activeChunkCount}개`
      : null;
  const caseCount = pack.retrievalEvaluation?.set?.activeCaseCount ?? 0;

  if (!started) {
    return {
      userState: "auto_check_not_started",
      userTitle: "지식팩 자동 점검 대기",
      userMessage:
        "초안 생성 후 자동 점검이 아직 준비되지 않았습니다. 자동 점검을 시작하면 검수 준비가 진행됩니다.",
      primaryActionLabel: "자동 점검 시작",
      primaryActionKind: "RUN_AUTO_PREPARE",
      passedTitles,
      fixNeededTitles,
    };
  }

  if (retrievalFailed) {
    const reasons = [
      activeChunkHint,
      caseCount > 0 ? `평가 케이스 ${caseCount}개` : null,
      "검색 가능한 지식 데이터와 평가 케이스 정합성을 다시 맞춰야 합니다.",
    ].filter(Boolean) as string[];
    return {
      userState: "system_fix_available",
      userTitle: "검색 품질 점검 결과: 보완 필요",
      userMessage:
        "검색 가능한 지식 데이터가 부족하거나 평가 케이스가 현재 지식 범위와 맞지 않습니다. 시스템이 검색용 Chunk와 평가 케이스를 다시 생성한 뒤 재점검할 수 있습니다.",
      primaryActionLabel: "검색용 데이터 자동 보완",
      primaryActionKind: "REPAIR_RETRIEVAL_DATA",
      passedTitles,
      fixNeededTitles: reasons.length > 0 ? reasons : fixNeededTitles,
    };
  }

  return {
    userState: "system_fix_available",
    userTitle: "지식팩 자동 점검 결과: 보완 필요",
    userMessage:
      "시스템이 초안 생성 결과를 기준으로 자동 점검을 수행했습니다. 아래 항목은 자료 보완 또는 자동 재생성이 필요합니다.",
    primaryActionLabel: "자동 재생성 및 점검",
    primaryActionKind: "REGENERATE_AND_CHECK",
    passedTitles,
    fixNeededTitles,
  };
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
    const current = steps.find(
      (s) => s.checklistStatus === "current" || s.checklistStatus === "failed",
    );
    currentStepId =
      current?.id ??
      (plan.completedStepCount >= plan.totalStepCount ? "completed" : "structure_quality");
  }

  const userFacing = resolveUserFacingState({
    pack: input.pack,
    sourceDocumentCount: input.sourceDocumentCount,
    knowledgeUnitDraftCount: input.knowledgeUnitDraftCount,
    plan,
    nextAction,
  });

  return {
    currentStepId,
    currentStepTitle:
      nextAction === "GO_TO_SUBMIT_REVIEW" ? "점검 완료: 검수요청 가능" : plan.currentStepTitle,
    completedCount: plan.completedStepCount,
    totalCount: plan.totalStepCount,
    canSubmitReview: plan.canSubmitReview,
    nextAction,
    nextActionLabel:
      userFacing.primaryActionLabel ||
      (nextAction === "GO_TO_SUBMIT_REVIEW" ? PROVIDER_PACK_GO_TO_REVIEW_TAB : plan.nextActionLabel),
    nextActionDescription: userFacing.userMessage || plan.nextActionDescription,
    incompleteStepTitles: plan.incompleteStepTitles,
    ...userFacing,
    steps,
    plan,
  };
}

export function isInspectionComplete(readiness: InspectionReadiness): boolean {
  return readiness.completedCount >= readiness.totalCount && readiness.canSubmitReview;
}

/** @deprecated Prefer primaryActionLabel from readiness */
export const INSPECTION_SHORT_CTA = PROVIDER_PACK_GO_TO_INSPECTION_SHORT;
