/**
 * Derived Store workflow status — no new Prisma enums.
 * Combines PackStatus + Worker ZIP request + quality + provider-review +
 * service-validation markers into a single process stage for CTA/rail UX.
 */

import type { PackStatus } from "@prisma/client";

export const STORE_WORKFLOW_STATUSES = [
  "DRAFT",
  "SOURCE_REGISTERING",
  "SOURCE_SUBMITTED",
  "ADMIN_RECEIVED",
  "KNOWLEDGE_GENERATING",
  "KNOWLEDGE_GENERATED",
  "ADMIN_QUALITY_CHECKING",
  "ADMIN_QUALITY_PASSED",
  "PROVIDER_REVIEW_REQUESTED",
  "PROVIDER_REVIEWING",
  "PROVIDER_REVIEW_CONFIRMED",
  "PROVIDER_WITHDRAWN",
  "SERVICE_VALIDATING",
  "SERVICE_VALIDATION_PASSED",
  "REVIEWING",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
  "SUSPENDED",
] as const;

export type StoreWorkflowStatus = (typeof STORE_WORKFLOW_STATUSES)[number];

export type StoreProviderReviewPhase =
  | "NONE"
  | "REQUESTED"
  | "CONFIRMED"
  | "WITHDRAWN";

export type StoreServiceValidationPhase = "NONE" | "PASSED";

export type DeriveStoreWorkflowStatusInput = {
  packStatus: PackStatus | string;
  latestRejectionReason?: string | null;
  /** Worker ZIP request phase (derived). */
  workerZipRequestStatus?:
    | "NONE"
    | "REQUESTED"
    | "ACCEPTED"
    | "REJECTED"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED"
    | null;
  /** Admin hold after 접수 (subset of zip lifecycle). */
  adminGenerationHold?: "ACCEPTED" | "PROCESSING" | "COMPLETED" | null;
  /** True when persisted quality gate snapshot is complete without blockers. */
  adminQualityPassed?: boolean;
  /** True when quality has been run but still has blockers / incomplete. */
  adminQualityStarted?: boolean;
  providerReviewPhase?: StoreProviderReviewPhase | null;
  serviceValidationPhase?: StoreServiceValidationPhase | null;
  /** Basic info complete (name/category/desc/language). */
  basicInfoReady?: boolean;
  /** Source materials ready for progress. */
  sourceMaterialsReady?: boolean;
};

export type StoreWorkflowStatusLabel = {
  status: StoreWorkflowStatus;
  label: string;
  providerStatusLabel: string;
};

const LABELS: Record<StoreWorkflowStatus, { label: string; providerStatusLabel: string }> = {
  DRAFT: { label: "초안", providerStatusLabel: "작성 중" },
  SOURCE_REGISTERING: { label: "원본 자료 등록", providerStatusLabel: "자료 등록 필요" },
  SOURCE_SUBMITTED: { label: "처리 요청됨", providerStatusLabel: "관리자 접수 대기" },
  ADMIN_RECEIVED: { label: "관리자 접수됨", providerStatusLabel: "관리자 처리 중" },
  KNOWLEDGE_GENERATING: {
    label: "지식데이터 생성 중",
    providerStatusLabel: "지식데이터 생성 중",
  },
  KNOWLEDGE_GENERATED: {
    label: "지식데이터 생성 완료",
    providerStatusLabel: "관리자 품질점검 대기",
  },
  ADMIN_QUALITY_CHECKING: {
    label: "관리자 품질점검 중",
    providerStatusLabel: "관리자 품질점검 중",
  },
  ADMIN_QUALITY_PASSED: {
    label: "품질점검 통과",
    providerStatusLabel: "제공자 검토 요청 대기",
  },
  PROVIDER_REVIEW_REQUESTED: {
    label: "제공자 검토 요청됨",
    providerStatusLabel: "생성 결과 검토 필요",
  },
  PROVIDER_REVIEWING: {
    label: "제공자 검토 중",
    providerStatusLabel: "생성 결과 확인 중",
  },
  PROVIDER_REVIEW_CONFIRMED: {
    label: "제공자 확인 완료",
    providerStatusLabel: "관리자 서비스 검증 대기",
  },
  PROVIDER_WITHDRAWN: {
    label: "제공자 회수",
    providerStatusLabel: "자료 재등록 필요",
  },
  SERVICE_VALIDATING: {
    label: "서비스 검증 중",
    providerStatusLabel: "관리자 서비스 검증 중",
  },
  SERVICE_VALIDATION_PASSED: {
    label: "서비스 검증 통과",
    providerStatusLabel: "최종 검수 대기",
  },
  REVIEWING: { label: "최종 검수 중", providerStatusLabel: "검수 요청됨" },
  APPROVED: { label: "승인됨", providerStatusLabel: "승인됨" },
  REJECTED: { label: "보완 요청", providerStatusLabel: "보완 필요" },
  PUBLISHED: { label: "공개됨", providerStatusLabel: "공개 중" },
  SUSPENDED: { label: "중단/보관", providerStatusLabel: "중단됨" },
};

export function describeStoreWorkflowStatus(
  status: StoreWorkflowStatus,
): StoreWorkflowStatusLabel {
  const entry = LABELS[status];
  return { status, label: entry.label, providerStatusLabel: entry.providerStatusLabel };
}

/**
 * Derive the highest-priority workflow stage from persisted inputs.
 * Lifecycle overlays (review/hold/confirm) always beat draft authoring stages.
 */
export function deriveStoreWorkflowStatus(
  input: DeriveStoreWorkflowStatusInput,
): StoreWorkflowStatus {
  const packStatus = input.packStatus;
  const zip = input.workerZipRequestStatus ?? null;
  const hold = input.adminGenerationHold ?? null;
  const providerPhase = input.providerReviewPhase ?? "NONE";
  const servicePhase = input.serviceValidationPhase ?? "NONE";

  if (packStatus === "SUSPENDED" || packStatus === "DEPRECATED") {
    return "SUSPENDED";
  }
  if (packStatus === "PUBLISHED" || packStatus === "VERIFIED") {
    return "PUBLISHED";
  }
  if (packStatus === "REVIEWING") {
    return "REVIEWING";
  }
  if (packStatus === "DRAFT" && input.latestRejectionReason?.trim()) {
    return "REJECTED";
  }

  // Active admin/provider handoff beats withdrawn/draft authoring.
  if (providerPhase === "CONFIRMED") {
    return servicePhase === "PASSED" ? "SERVICE_VALIDATION_PASSED" : "SERVICE_VALIDATING";
  }

  if (providerPhase === "REQUESTED") {
    return "PROVIDER_REVIEW_REQUESTED";
  }

  if (hold === "PROCESSING" || zip === "PROCESSING") {
    return "KNOWLEDGE_GENERATING";
  }
  if (hold === "ACCEPTED" || zip === "ACCEPTED") {
    return "ADMIN_RECEIVED";
  }

  if (hold === "COMPLETED" || zip === "COMPLETED") {
    if (input.adminQualityPassed) return "ADMIN_QUALITY_PASSED";
    if (input.adminQualityStarted) return "ADMIN_QUALITY_CHECKING";
    return "KNOWLEDGE_GENERATED";
  }

  if (zip === "REQUESTED") {
    return "SOURCE_SUBMITTED";
  }

  // Withdraw only while no newer ZIP request / hold is active.
  if (providerPhase === "WITHDRAWN") {
    return "PROVIDER_WITHDRAWN";
  }

  if (zip === "FAILED" || zip === "REJECTED") {
    return "SOURCE_REGISTERING";
  }

  if (input.basicInfoReady === false || input.basicInfoReady == null) {
    if (!input.sourceMaterialsReady) {
      // Incomplete basic info → DRAFT authoring; if materials missing use SOURCE when basic done.
      return "DRAFT";
    }
    return "DRAFT";
  }

  if (!input.sourceMaterialsReady) {
    return "SOURCE_REGISTERING";
  }

  return "DRAFT";
}

/** Stages where provider must not see draft authoring CTAs. */
export function isStoreWorkflowAdminOwned(status: StoreWorkflowStatus): boolean {
  return (
    status === "SOURCE_SUBMITTED" ||
    status === "ADMIN_RECEIVED" ||
    status === "KNOWLEDGE_GENERATING" ||
    status === "KNOWLEDGE_GENERATED" ||
    status === "ADMIN_QUALITY_CHECKING" ||
    status === "ADMIN_QUALITY_PASSED" ||
    status === "PROVIDER_REVIEW_REQUESTED" ||
    status === "PROVIDER_REVIEWING" ||
    status === "PROVIDER_REVIEW_CONFIRMED" ||
    status === "SERVICE_VALIDATING" ||
    status === "SERVICE_VALIDATION_PASSED" ||
    status === "REVIEWING"
  );
}

export function canShowDraftContinueCta(status: StoreWorkflowStatus): boolean {
  return status === "DRAFT";
}

export function canShowMaterialRegisterCta(status: StoreWorkflowStatus): boolean {
  return (
    status === "DRAFT" ||
    status === "SOURCE_REGISTERING" ||
    status === "PROVIDER_WITHDRAWN" ||
    status === "REJECTED"
  );
}

export function canShowReviewSubmitCta(status: StoreWorkflowStatus): boolean {
  return (
    status === "DRAFT" ||
    status === "SOURCE_REGISTERING" ||
    status === "PROVIDER_WITHDRAWN" ||
    status === "REJECTED"
  );
}
