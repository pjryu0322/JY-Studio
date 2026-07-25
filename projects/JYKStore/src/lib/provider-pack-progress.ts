import type { PackStatus } from "@prisma/client";
import {
  resolveProviderRegistrationReadiness,
  type ProviderRegistrationStepId,
  type ProviderRegistrationStepStatus,
} from "@/lib/provider-registration-readiness";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";
import {
  deriveStoreWorkflowStatus,
  describeStoreWorkflowStatus,
  type StoreProviderReviewPhase,
  type StoreServiceValidationPhase,
  type StoreWorkflowStatus,
} from "@/lib/store-workflow-status";

/** Registration progress steps — aligned with provider pack tabs. */
export type ProviderPackProgressStepKey = ProviderRegistrationStepId;

export type ProviderPackProgressStepStatus =
  | "COMPLETED"
  | "CURRENT"
  | "WAITING"
  | "BLOCKED"
  | "STALE"
  | "LOCKED";

/**
 * currentStep may be a registration step or a lifecycle overlay
 * (not shown as a sixth authoring step).
 */
export type ProviderPackCurrentStep =
  | ProviderPackProgressStepKey
  | "PUBLISHED"
  | "CHANGES_REQUESTED"
  | "SUSPENDED"
  | "REVIEWING"
  | "SOURCE_SUBMITTED"
  | "ADMIN_RECEIVED"
  | "KNOWLEDGE_GENERATING"
  | "KNOWLEDGE_GENERATED"
  | "ADMIN_QUALITY_CHECKING"
  | "ADMIN_QUALITY_PASSED"
  | "PROVIDER_REVIEW_REQUESTED"
  | "PROVIDER_REVIEW_CONFIRMED"
  | "PROVIDER_WITHDRAWN"
  | "SERVICE_VALIDATING"
  | "SERVICE_VALIDATION_PASSED";

export type ProviderPackProgressStep = {
  key: ProviderPackProgressStepKey;
  label: string;
  description: string;
  status: ProviderPackProgressStepStatus;
  href: string | null;
};

export type ProviderPackProgressAction = {
  label: string;
  href: string;
};

export type ProviderPackProgressDto = {
  packId: string;
  packStatus: PackStatus;
  /** Lifecycle status for display — separate from registration steps. */
  lifecycleStatus: PackStatus;
  /** Derived Store process stage (persisted inputs, not URL). */
  storeWorkflowStatus: StoreWorkflowStatus;
  publishedVersion: { id: string; version: string } | null;
  workingVersion: { id: string; version: string; status: string } | null;
  currentStep: ProviderPackCurrentStep;
  currentStepLabel: string;
  nextActionLabel: string;
  nextActionHref: string | null;
  steps: ProviderPackProgressStep[];
  actions: ProviderPackProgressAction[];
};

export type ProviderPacksStatusSummary = {
  total: number;
  draft: number;
  reviewing: number;
  /** Admin requested provider generation-result review (not PackStatus.REVIEWING). */
  providerReviewRequested: number;
  published: number;
  verified: number;
  changesRequested: number;
  suspended: number;
};

export type BuildProviderPackProgressInput = {
  packId: string;
  packStatus: PackStatus;
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  /** Provider-selected document language; required for basic-info readiness. */
  language?: string | null;
  latestRejectionReason?: string | null;
  /** Admin ZIP 접수 hold — list + detail must pass this for correct CTAs. */
  adminGenerationHold?: "ACCEPTED" | "PROCESSING" | "COMPLETED" | null;
  workerZipRequestStatus?:
    | "NONE"
    | "REQUESTED"
    | "ACCEPTED"
    | "REJECTED"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | null;
  providerReviewPhase?: StoreProviderReviewPhase | null;
  serviceValidationPhase?: StoreServiceValidationPhase | null;
  adminQualityPassed?: boolean;
  adminQualityStarted?: boolean;
  workingVersion: {
    id: string;
    version: string;
    sourceDocumentCount: number;
    materialReady: boolean;
    /** STRUCTURE + KU + Chunk on current binding (optional for coarse list). */
    structureReady?: boolean;
    /** SEARCH_INDEX + RETRIEVAL_EVALUATION (optional for coarse list). */
    searchFoundationReady?: boolean;
    /** API+MCP+DOWNLOAD preparation channels confirmed. */
    searchValidationReady?: boolean;
    distributionReady: boolean;
    pipelineCurrent?: boolean;
  } | null;
  publishedVersion: {
    id: string;
    version: string;
  } | null;
};

const STEP_DESCRIPTIONS: Record<ProviderPackProgressStepKey, string> = {
  BASIC_INFO: "지식팩 이름·카테고리·설명·문서 언어를 입력합니다.",
  SOURCE_MATERIALS: "원본문서와 Docling 산출물을 등록하고 확인합니다.",
  DATA_STRUCTURE: "문서 구조·Knowledge Unit·Retrieval Chunk를 생성합니다.",
  SEARCH_DATA_VALIDATION:
    "검색데이터 생성·검색 품질과 API·MCP·DOWNLOAD를 검증합니다.",
  DISTRIBUTION_REVIEW: "공개 채널·유통 권한을 입력하고 검수요청을 제출합니다.",
};

function detailHref(packId: string, tab?: string | null): string {
  const base = providerPackDetailPath(packId);
  return tab ? `${base}?tab=${tab}` : base;
}

function basicInfoReady(input: BuildProviderPackProgressInput): boolean {
  return Boolean(
    input.name.trim() &&
      input.categoryId.trim() &&
      input.shortDescription.trim() &&
      input.description.trim() &&
      (input.language === "ko" || input.language === "en"),
  );
}

function isPublishedStatus(status: PackStatus): boolean {
  return status === "PUBLISHED" || status === "VERIFIED";
}

function isSuspendedStatus(status: PackStatus): boolean {
  return status === "SUSPENDED" || status === "DEPRECATED";
}

function hasActiveWorkingDraft(input: BuildProviderPackProgressInput): boolean {
  if (!input.workingVersion) return false;
  if (!isPublishedStatus(input.packStatus)) return true;
  if (!input.publishedVersion) return true;
  return input.workingVersion.id !== input.publishedVersion.id;
}

function mapRegistrationStatus(
  status: ProviderRegistrationStepStatus,
  isCurrent: boolean,
): ProviderPackProgressStepStatus {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "STALE") return "STALE";
  if (status === "LOCKED" || status === "BLOCKED") return "LOCKED";
  if (status === "IN_PROGRESS" || isCurrent) return "CURRENT";
  if (status === "WARNING") return "CURRENT";
  return "WAITING";
}

export function buildProviderPacksStatusSummary(
  packs: Array<{
    status: PackStatus;
    latestRejectionReason?: string | null;
    storeWorkflowStatus?: StoreWorkflowStatus | null;
    providerReviewPhase?: StoreProviderReviewPhase | null;
  }>,
): ProviderPacksStatusSummary {
  const summary: ProviderPacksStatusSummary = {
    total: packs.length,
    draft: 0,
    reviewing: 0,
    providerReviewRequested: 0,
    published: 0,
    verified: 0,
    changesRequested: 0,
    suspended: 0,
  };

  for (const pack of packs) {
    const reviewRequested =
      pack.storeWorkflowStatus === "PROVIDER_REVIEW_REQUESTED" ||
      pack.providerReviewPhase === "REQUESTED";
    if (reviewRequested) {
      summary.providerReviewRequested += 1;
      continue;
    }
    if (pack.status === "REVIEWING") {
      summary.reviewing += 1;
      continue;
    }
    if (pack.status === "PUBLISHED") {
      summary.published += 1;
      continue;
    }
    if (pack.status === "VERIFIED") {
      summary.verified += 1;
      continue;
    }
    if (isSuspendedStatus(pack.status)) {
      summary.suspended += 1;
      continue;
    }
    if (pack.status === "DRAFT" && pack.latestRejectionReason?.trim()) {
      summary.changesRequested += 1;
      continue;
    }
    if (pack.status === "DRAFT") {
      summary.draft += 1;
    }
  }

  return summary;
}

export function buildProviderPackProgress(
  input: BuildProviderPackProgressInput,
): ProviderPackProgressDto {
  const packId = input.packId;
  const basicReady = basicInfoReady(input);
  const materialIsReady = Boolean(input.workingVersion?.materialReady);
  const structureReady = Boolean(input.workingVersion?.structureReady);
  const searchFoundationReady = Boolean(
    input.workingVersion?.searchFoundationReady ?? structureReady,
  );
  const searchValidationReady = Boolean(input.workingVersion?.searchValidationReady);
  const distributionIsReady = Boolean(input.workingVersion?.distributionReady);
  const pipelineCurrent = input.workingVersion?.pipelineCurrent !== false;
  const workingDraft = hasActiveWorkingDraft(input);
  const rejected = Boolean(
    input.packStatus === "DRAFT" && input.latestRejectionReason?.trim(),
  );

  const storeWorkflowStatus = deriveStoreWorkflowStatus({
    packStatus: input.packStatus,
    latestRejectionReason: input.latestRejectionReason,
    workerZipRequestStatus: input.workerZipRequestStatus,
    adminGenerationHold: input.adminGenerationHold,
    adminQualityPassed: input.adminQualityPassed,
    adminQualityStarted: input.adminQualityStarted,
    providerReviewPhase: input.providerReviewPhase,
    serviceValidationPhase: input.serviceValidationPhase,
    basicInfoReady: basicReady,
    sourceMaterialsReady: materialIsReady,
  });
  const workflowLabel = describeStoreWorkflowStatus(storeWorkflowStatus);

  const readiness = resolveProviderRegistrationReadiness({
    packId,
    packStatus: input.packStatus,
    basicInfoReady: basicReady,
    sourceMaterialsReady: materialIsReady,
    structurePassed: structureReady,
    searchFoundationPassed: searchFoundationReady,
    allPreparationChannelsPassed: searchValidationReady,
    distributionMetadataReady: distributionIsReady,
    pipelineCurrent,
    structureStale: materialIsReady && !pipelineCurrent,
    searchValidationStale: structureReady && !pipelineCurrent,
    latestRejectionReason: input.latestRejectionReason,
  });

  const steps: ProviderPackProgressStep[] = readiness.steps.map((step) => ({
    key: step.id,
    label: step.label,
    description: STEP_DESCRIPTIONS[step.id],
    status: mapRegistrationStatus(step.status, step.id === readiness.currentStepId),
    href: step.href,
  }));

  let currentStep: ProviderPackCurrentStep =
    readiness.currentStepId ?? "BASIC_INFO";
  let currentStepLabel =
    readiness.steps.find((s) => s.id === readiness.currentStepId)?.label ?? "기본정보";
  let nextActionLabel = "다음 단계를 진행하세요.";
  let nextActionHref: string | null =
    readiness.steps.find((s) => s.id === readiness.currentStepId)?.href ?? null;
  let actions: ProviderPackProgressAction[] = nextActionHref
    ? [{ label: "이어서 작성", href: nextActionHref }]
    : [{ label: "상세 보기", href: detailHref(packId) }];

  if (isSuspendedStatus(input.packStatus)) {
    currentStep = "SUSPENDED";
    currentStepLabel = input.packStatus === "DEPRECATED" ? "보관됨" : "중단됨";
    nextActionLabel = "상태를 확인하세요.";
    nextActionHref = detailHref(packId);
    actions = [{ label: "상태 확인", href: detailHref(packId) }];
    for (const step of steps) step.status = "BLOCKED";
  } else if (rejected || storeWorkflowStatus === "REJECTED") {
    currentStep = "CHANGES_REQUESTED";
    currentStepLabel = workflowLabel.providerStatusLabel;
    nextActionLabel = "보완사항을 확인하고 수정 후 재요청하세요.";
    nextActionHref = detailHref(packId, "distributionReview");
    actions = [
      { label: "보완사항 보기", href: detailHref(packId, "distributionReview") },
      { label: "수정 후 재요청", href: detailHref(packId, "payload") },
    ];
  } else if (storeWorkflowStatus === "REVIEWING" || input.packStatus === "REVIEWING") {
    currentStep = "REVIEWING";
    currentStepLabel = workflowLabel.providerStatusLabel;
    nextActionLabel = "검수 결과를 기다리세요.";
    nextActionHref = detailHref(packId, "distributionReview");
    actions = [
      { label: "검수 상태 보기", href: detailHref(packId, "distributionReview") },
      { label: "제출 내용 확인", href: detailHref(packId, "distributionReview") },
    ];
    for (const step of steps) {
      step.status = "COMPLETED";
    }
  } else if (isPublishedStatus(input.packStatus) && !workingDraft) {
    currentStep = "PUBLISHED";
    currentStepLabel = workflowLabel.providerStatusLabel;
    nextActionLabel = "공개 정보와 사용 통계를 확인하세요.";
    nextActionHref = detailHref(packId, "distributionReview");
    actions = [
      { label: "공개 정보 관리", href: detailHref(packId, "distributionReview") },
      { label: "사용 통계 보기", href: ROUTES.accountPlan },
    ];
    for (const step of steps) step.status = "COMPLETED";
  } else if (storeWorkflowStatus === "PROVIDER_REVIEW_REQUESTED") {
    currentStep = "PROVIDER_REVIEW_REQUESTED";
    currentStepLabel = workflowLabel.providerStatusLabel;
    nextActionLabel = "관리자가 생성·품질점검한 지식데이터를 검토해 주세요.";
    nextActionHref = detailHref(packId, "knowledge");
    actions = [
      { label: "검토하기", href: detailHref(packId, "knowledge") },
    ];
    for (const step of steps) {
      if (step.key === "BASIC_INFO" || step.key === "SOURCE_MATERIALS") {
        step.status = "COMPLETED";
      } else {
        step.status = "LOCKED";
      }
    }
  } else if (
    storeWorkflowStatus === "PROVIDER_REVIEW_CONFIRMED" ||
    storeWorkflowStatus === "SERVICE_VALIDATING" ||
    storeWorkflowStatus === "SERVICE_VALIDATION_PASSED"
  ) {
    currentStep =
      storeWorkflowStatus === "SERVICE_VALIDATION_PASSED"
        ? "SERVICE_VALIDATION_PASSED"
        : storeWorkflowStatus === "SERVICE_VALIDATING"
          ? "SERVICE_VALIDATING"
          : "PROVIDER_REVIEW_CONFIRMED";
    currentStepLabel = workflowLabel.providerStatusLabel;
    nextActionLabel = "관리자 서비스 검증·최종 검수 결과를 기다리세요.";
    nextActionHref = detailHref(packId, "distributionReview");
    actions = [
      { label: "검수 상태 보기", href: detailHref(packId, "distributionReview") },
    ];
    for (const step of steps) step.status = "LOCKED";
  } else if (storeWorkflowStatus === "SOURCE_SUBMITTED") {
    currentStep = "SOURCE_SUBMITTED";
    currentStepLabel = workflowLabel.providerStatusLabel;
    nextActionLabel = "관리자 접수를 기다리세요.";
    nextActionHref = detailHref(packId, "payload");
    actions = [
      { label: "제출 내용 확인", href: detailHref(packId, "payload") },
    ];
    for (const step of steps) {
      if (step.key === "BASIC_INFO" || step.key === "SOURCE_MATERIALS") {
        step.status = "COMPLETED";
      } else {
        step.status = "LOCKED";
      }
    }
  } else if (
    storeWorkflowStatus === "ADMIN_RECEIVED" ||
    storeWorkflowStatus === "KNOWLEDGE_GENERATING" ||
    storeWorkflowStatus === "KNOWLEDGE_GENERATED" ||
    storeWorkflowStatus === "ADMIN_QUALITY_CHECKING" ||
    storeWorkflowStatus === "ADMIN_QUALITY_PASSED"
  ) {
    currentStep = storeWorkflowStatus;
    currentStepLabel = workflowLabel.providerStatusLabel;
    nextActionLabel =
      storeWorkflowStatus === "ADMIN_QUALITY_CHECKING"
        ? "관리자 품질점검이 진행 중입니다."
        : "관리자 처리 상태를 확인하세요.";
    nextActionHref = detailHref(packId, "knowledge");
    actions =
      storeWorkflowStatus === "ADMIN_QUALITY_CHECKING"
        ? [{ label: "품질점검 진행 중", href: detailHref(packId, "knowledge") }]
        : [{ label: "처리 상태 보기", href: detailHref(packId, "knowledge") }];
    for (const step of steps) {
      if (step.key === "BASIC_INFO" || step.key === "SOURCE_MATERIALS") {
        step.status = "COMPLETED";
      } else {
        step.status = "LOCKED";
      }
    }
  } else if (storeWorkflowStatus === "PROVIDER_WITHDRAWN") {
    currentStep = "PROVIDER_WITHDRAWN";
    currentStepLabel = workflowLabel.providerStatusLabel;
    nextActionLabel = "원본 자료를 다시 등록하고 처리 요청하세요.";
    nextActionHref = detailHref(packId, "payload");
    actions = [
      { label: "자료등록", href: detailHref(packId, "payload") },
      { label: "기본정보 수정", href: detailHref(packId, "basic") },
    ];
  } else {
    // Authoring path — derive next action from readiness current step.
    const current = readiness.steps.find((s) => s.id === readiness.currentStepId);
    if (current) {
      currentStep = current.id;
      currentStepLabel = current.label;
      nextActionHref = current.href ?? detailHref(packId, current.tab);
      if (current.id === "BASIC_INFO") {
        nextActionLabel = materialIsReady
          ? "문서 언어 등 남은 기본정보를 입력하세요."
          : "지식팩 기본정보를 입력하세요.";
        actions = materialIsReady
          ? [
              { label: "기본정보 완성", href: detailHref(packId, "basic") },
              { label: "구조화 결과 확인", href: detailHref(packId, "knowledge") },
            ]
          : [
              { label: "계속 작성", href: detailHref(packId, "basic") },
              { label: "자료등록", href: detailHref(packId, "payload") },
            ];
      } else if (current.id === "SOURCE_MATERIALS") {
        nextActionLabel = "원본문서와 생성 도구 산출물을 등록하세요.";
        actions = [
          { label: "자료등록", href: detailHref(packId, "payload") },
          { label: "기본정보 수정", href: detailHref(packId, "basic") },
        ];
      } else if (current.id === "DATA_STRUCTURE") {
        nextActionLabel = "데이터 구조화를 실행·확인하세요.";
        actions = [
          { label: "데이터 구조화 진행", href: detailHref(packId, "knowledge") },
          { label: "첨부자료 확인", href: detailHref(packId, "payload") },
        ];
      } else if (current.id === "SEARCH_DATA_VALIDATION") {
        nextActionLabel = "검색데이터 생성·검증을 완료하세요.";
        actions = [
          { label: "검색데이터 생성·검증", href: detailHref(packId, "serviceValidation") },
          { label: "구조화 결과 보기", href: detailHref(packId, "knowledge") },
        ];
      } else if (!distributionIsReady) {
        nextActionLabel = "출처·라이선스·공개 범위를 입력하세요.";
        actions = [
          { label: "유통정보 입력", href: detailHref(packId, "distributionReview") },
          { label: "검증 결과 보기", href: detailHref(packId, "serviceValidation") },
        ];
      } else {
        nextActionLabel = "검수 요청을 제출하세요.";
        actions = [
          { label: "검수 요청", href: detailHref(packId, "distributionReview") },
          { label: "제출 전 확인", href: detailHref(packId, "distributionReview") },
        ];
      }
    }
  }

  return {
    packId,
    packStatus: input.packStatus,
    lifecycleStatus: input.packStatus,
    storeWorkflowStatus,
    publishedVersion: input.publishedVersion,
    workingVersion: input.workingVersion
      ? {
          id: input.workingVersion.id,
          version: input.workingVersion.version,
          status: input.packStatus,
        }
      : null,
    currentStep,
    currentStepLabel,
    nextActionLabel,
    nextActionHref,
    steps,
    actions,
  };
}

/**
 * Docling REVIEW_READY or validated ZIP payload.
 * Legacy source-only packs must set legacySourceOnly explicitly.
 */
export function isMaterialReadyForProgress(input: {
  sourceDocumentCount: number;
  payloadValidationStatus?: string | null;
  doclingBundleStatus?: string | null;
  /** Explicit legacy ZIP/source-only path without Docling REVIEW_READY. */
  legacySourceOnly?: boolean;
}): boolean {
  if (input.payloadValidationStatus === "VALID") return true;
  if (input.doclingBundleStatus === "REVIEW_READY") return true;
  if (input.legacySourceOnly && input.sourceDocumentCount > 0) return true;
  return false;
}

export function isDistributionReadyForProgress(input: {
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  rightsBasis?: string | null;
  rightsConfirmedAt?: Date | string | null;
  allowApi?: boolean;
  allowMcp?: boolean;
  allowDownload?: boolean;
  /** @deprecated Prefer rightsBasis + channels. */
  licenseName?: string | null;
} | null | undefined): boolean {
  if (!input) return false;
  const hasSource = Boolean(input.sourceTitle?.trim() || input.sourceUrl?.trim());
  const hasRights = Boolean(input.rightsBasis && input.rightsConfirmedAt);
  const hasChannel = Boolean(input.allowApi || input.allowMcp || input.allowDownload);
  if (hasSource && hasRights && hasChannel) return true;
  // Legacy fallback for packs without rightsBasis yet
  const hasLicense = Boolean(input.licenseName?.trim());
  return hasSource && hasLicense;
}

/** Coarse list heuristic: pack pipeline finished search-foundation stages. */
export function isPipelineReadyForProgress(pipelineStatus: string | null | undefined): boolean {
  return pipelineStatus === "READY_FOR_REVIEW";
}
