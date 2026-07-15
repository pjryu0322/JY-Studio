import type { PackStatus } from "@prisma/client";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";

export type ProviderPackProgressStepKey =
  | "BASIC_INFO"
  | "MATERIAL"
  | "DISTRIBUTION"
  | "REVIEW"
  | "APPROVAL";

export type ProviderPackProgressStepStatus =
  | "COMPLETED"
  | "CURRENT"
  | "WAITING"
  | "BLOCKED";

export type ProviderPackCurrentStep =
  | ProviderPackProgressStepKey
  | "PUBLISHED"
  | "CHANGES_REQUESTED"
  | "SUSPENDED";

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
  workingVersion: {
    id: string;
    version: string;
    sourceDocumentCount: number;
    materialReady: boolean;
    distributionReady: boolean;
  } | null;
  publishedVersion: {
    id: string;
    version: string;
  } | null;
};

const STEP_META: Record<
  ProviderPackProgressStepKey,
  { label: string; description: string; tab: "basic" | "payload" | "distribution" | "review" | null }
> = {
  BASIC_INFO: {
    label: "기본정보",
    description: "지식팩 이름·카테고리·설명·문서 언어를 입력합니다.",
    tab: "basic",
  },
  MATERIAL: {
    label: "자료 등록",
    description: "외부 생성 도구에서 만든 지식팩 자료와 원본문서를 등록합니다.",
    tab: "payload",
  },
  DISTRIBUTION: {
    label: "유통정보",
    description: "제공 방식·유통 권한·공개 범위를 입력합니다.",
    tab: "distribution",
  },
  REVIEW: {
    label: "검수 요청",
    description: "서비스 검증 후 검수 요청을 제출합니다.",
    tab: "review",
  },
  APPROVAL: {
    label: "승인·공개",
    description: "운영자가 승인하면 스토어에 공개됩니다.",
    tab: "review",
  },
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

function materialReady(input: BuildProviderPackProgressInput): boolean {
  return Boolean(input.workingVersion?.materialReady);
}

function distributionReady(input: BuildProviderPackProgressInput): boolean {
  return Boolean(input.workingVersion?.distributionReady);
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

export function buildProviderPacksStatusSummary(
  packs: Array<{ status: PackStatus; latestRejectionReason?: string | null }>,
): ProviderPacksStatusSummary {
  const summary: ProviderPacksStatusSummary = {
    total: packs.length,
    draft: 0,
    reviewing: 0,
    published: 0,
    verified: 0,
    changesRequested: 0,
    suspended: 0,
  };

  for (const pack of packs) {
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
  const materialIsReady = materialReady(input);
  const distributionIsReady = distributionReady(input);
  const workingDraft = hasActiveWorkingDraft(input);
  const rejected = Boolean(
    input.packStatus === "DRAFT" && input.latestRejectionReason?.trim(),
  );

  let currentStep: ProviderPackCurrentStep = "BASIC_INFO";
  let currentStepLabel = "기본정보";
  let nextActionLabel = "기본정보를 입력하세요.";
  let nextActionHref: string | null = detailHref(packId, "basic");
  let actions: ProviderPackProgressAction[] = [
    { label: "편집", href: detailHref(packId, "basic") },
  ];

  const stepStatuses: Record<ProviderPackProgressStepKey, ProviderPackProgressStepStatus> = {
    BASIC_INFO: "WAITING",
    MATERIAL: "WAITING",
    DISTRIBUTION: "WAITING",
    REVIEW: "WAITING",
    APPROVAL: "WAITING",
  };

  if (isSuspendedStatus(input.packStatus)) {
    currentStep = "SUSPENDED";
    currentStepLabel = input.packStatus === "DEPRECATED" ? "보관됨" : "중단됨";
    nextActionLabel = "상태를 확인하세요.";
    nextActionHref = detailHref(packId);
    actions = [{ label: "상태 확인", href: detailHref(packId) }];
    for (const key of Object.keys(stepStatuses) as ProviderPackProgressStepKey[]) {
      stepStatuses[key] = "BLOCKED";
    }
  } else if (rejected) {
    currentStep = "CHANGES_REQUESTED";
    currentStepLabel = "보완";
    nextActionLabel = "운영자 의견을 확인하고 새 자료 또는 새 Version을 제출하세요.";
    nextActionHref = detailHref(packId, "review");
    actions = [
      { label: "보완 내용 보기", href: detailHref(packId, "review") },
      { label: "자료 등록", href: detailHref(packId, "payload") },
    ];
    stepStatuses.BASIC_INFO = basicReady ? "COMPLETED" : "CURRENT";
    stepStatuses.MATERIAL = basicReady ? (materialIsReady ? "COMPLETED" : "CURRENT") : "WAITING";
    stepStatuses.DISTRIBUTION =
      basicReady && materialIsReady
        ? distributionIsReady
          ? "COMPLETED"
          : "CURRENT"
        : "WAITING";
    stepStatuses.REVIEW = "CURRENT";
    stepStatuses.APPROVAL = "WAITING";
  } else if (input.packStatus === "REVIEWING") {
    currentStep = "APPROVAL";
    currentStepLabel = "운영자 검수";
    nextActionLabel = "검수 결과를 기다리세요.";
    nextActionHref = detailHref(packId, "review");
    actions = [{ label: "검수 상태 보기", href: detailHref(packId, "review") }];
    stepStatuses.BASIC_INFO = "COMPLETED";
    stepStatuses.MATERIAL = "COMPLETED";
    stepStatuses.DISTRIBUTION = "COMPLETED";
    stepStatuses.REVIEW = "COMPLETED";
    stepStatuses.APPROVAL = "CURRENT";
  } else if (isPublishedStatus(input.packStatus) && !workingDraft) {
    currentStep = "PUBLISHED";
    currentStepLabel = "공개됨";
    nextActionLabel = "상세 보기 또는 새 버전 등록";
    nextActionHref = detailHref(packId);
    actions = [
      { label: "상세 보기", href: detailHref(packId) },
      { label: "새 버전 만들기", href: ROUTES.providerPackNew },
    ];
    for (const key of Object.keys(stepStatuses) as ProviderPackProgressStepKey[]) {
      stepStatuses[key] = "COMPLETED";
    }
  } else if (isPublishedStatus(input.packStatus) && workingDraft) {
    stepStatuses.BASIC_INFO = basicReady ? "COMPLETED" : "CURRENT";
    stepStatuses.MATERIAL = basicReady
      ? materialIsReady
        ? "COMPLETED"
        : "CURRENT"
      : "WAITING";
    stepStatuses.DISTRIBUTION =
      basicReady && materialIsReady
        ? distributionIsReady
          ? "COMPLETED"
          : "CURRENT"
        : "WAITING";
    stepStatuses.REVIEW =
      basicReady && materialIsReady && distributionIsReady ? "CURRENT" : "WAITING";
    stepStatuses.APPROVAL = "WAITING";

    if (!basicReady) {
      currentStep = "BASIC_INFO";
      currentStepLabel = "기본정보";
      nextActionLabel = "작업 버전 기본정보를 입력하세요.";
      nextActionHref = detailHref(packId, "basic");
      actions = [{ label: "편집", href: detailHref(packId, "basic") }];
    } else if (!materialIsReady) {
      currentStep = "MATERIAL";
      currentStepLabel = "자료 등록";
      nextActionLabel = "작업 버전에 자료를 등록하세요.";
      nextActionHref = detailHref(packId, "payload");
      actions = [{ label: "자료 등록", href: detailHref(packId, "payload") }];
    } else if (!distributionIsReady) {
      currentStep = "DISTRIBUTION";
      currentStepLabel = "유통정보";
      nextActionLabel = "작업 버전 유통정보를 입력하세요.";
      nextActionHref = detailHref(packId, "distribution");
      actions = [{ label: "유통정보 입력", href: detailHref(packId, "distribution") }];
    } else {
      currentStep = "REVIEW";
      currentStepLabel = "검수 요청";
      nextActionLabel = "작업 버전 검수 요청을 제출하세요.";
      nextActionHref = detailHref(packId, "review");
      actions = [{ label: "검수 요청", href: detailHref(packId, "review") }];
    }
  } else if (!basicReady) {
    currentStep = "BASIC_INFO";
    currentStepLabel = "기본정보";
    nextActionLabel = "지식팩 기본정보를 입력하세요.";
    nextActionHref = detailHref(packId, "basic");
    actions = [
      { label: "편집", href: detailHref(packId, "basic") },
      { label: "자료 등록", href: detailHref(packId, "payload") },
    ];
    stepStatuses.BASIC_INFO = "CURRENT";
  } else if (!materialIsReady) {
    currentStep = "MATERIAL";
    currentStepLabel = "자료 등록";
    nextActionLabel = "원본문서와 생성 도구 산출물을 등록하세요.";
    nextActionHref = detailHref(packId, "payload");
    actions = [
      { label: "편집", href: detailHref(packId, "basic") },
      { label: "자료 등록", href: detailHref(packId, "payload") },
    ];
    stepStatuses.BASIC_INFO = "COMPLETED";
    stepStatuses.MATERIAL = "CURRENT";
  } else if (!distributionIsReady) {
    currentStep = "DISTRIBUTION";
    currentStepLabel = "유통정보";
    nextActionLabel = "출처·라이선스·공개 범위를 입력하세요.";
    nextActionHref = detailHref(packId, "distribution");
    actions = [{ label: "유통정보 입력", href: detailHref(packId, "distribution") }];
    stepStatuses.BASIC_INFO = "COMPLETED";
    stepStatuses.MATERIAL = "COMPLETED";
    stepStatuses.DISTRIBUTION = "CURRENT";
  } else if (input.packStatus === "DRAFT") {
    currentStep = "REVIEW";
    currentStepLabel = "검수 요청";
    nextActionLabel = "검수 요청을 제출하세요.";
    nextActionHref = detailHref(packId, "review");
    actions = [{ label: "검수 요청", href: detailHref(packId, "review") }];
    stepStatuses.BASIC_INFO = "COMPLETED";
    stepStatuses.MATERIAL = "COMPLETED";
    stepStatuses.DISTRIBUTION = "COMPLETED";
    stepStatuses.REVIEW = "CURRENT";
  } else {
    currentStep = "APPROVAL";
    currentStepLabel = "승인·공개";
    nextActionLabel = "검수 상태를 확인하세요.";
    nextActionHref = detailHref(packId, "review");
    actions = [{ label: "검수 상태 보기", href: detailHref(packId, "review") }];
    stepStatuses.BASIC_INFO = "COMPLETED";
    stepStatuses.MATERIAL = "COMPLETED";
    stepStatuses.DISTRIBUTION = "COMPLETED";
    stepStatuses.REVIEW = "COMPLETED";
    stepStatuses.APPROVAL = "CURRENT";
  }

  const steps: ProviderPackProgressStep[] = (
    Object.keys(STEP_META) as ProviderPackProgressStepKey[]
  ).map((key) => {
    const meta = STEP_META[key];
    const status = stepStatuses[key];
    return {
      key,
      label: meta.label,
      description: meta.description,
      status,
      href:
        status === "CURRENT" && meta.tab
          ? detailHref(packId, meta.tab)
          : status === "CURRENT"
            ? detailHref(packId)
            : null,
    };
  });

  return {
    packId,
    packStatus: input.packStatus,
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

/** True when ZIP payload is VALID or Docling bundle is REVIEW_READY (or legacy sources exist). */
export function isMaterialReadyForProgress(input: {
  sourceDocumentCount: number;
  payloadValidationStatus?: string | null;
  doclingBundleStatus?: string | null;
}): boolean {
  if (input.payloadValidationStatus === "VALID") return true;
  if (input.doclingBundleStatus === "REVIEW_READY") return true;
  if (input.sourceDocumentCount > 0) return true;
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
}): boolean {
  const hasSource = Boolean(input.sourceTitle?.trim() || input.sourceUrl?.trim());
  const hasRights = Boolean(input.rightsBasis && input.rightsConfirmedAt);
  const hasChannel = Boolean(input.allowApi || input.allowMcp || input.allowDownload);
  if (hasSource && hasRights && hasChannel) return true;
  // Legacy fallback for packs without rightsBasis yet
  const hasLicense = Boolean(input.licenseName?.trim());
  return hasSource && hasLicense;
}
