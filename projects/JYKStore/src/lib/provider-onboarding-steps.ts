import type { PackStatus } from "@prisma/client";
import {
  buildProviderPackProgress,
  type ProviderPackProgressDto,
  type ProviderPackProgressStep,
} from "@/lib/provider-pack-progress";
import { providerPackDetailPath, ROUTES } from "@/lib/routes";

export type ProviderOnboardingStepKey =
  | "pack"
  | "payload"
  | "distribution"
  | "review"
  | "publish";

export type ProviderOnboardingStepStatus = "done" | "current" | "pending";

export type ProviderOnboardingStep = {
  key: ProviderOnboardingStepKey;
  title: string;
  description: string;
  status: ProviderOnboardingStepStatus;
  href?: string;
};

const STEP_KEY_MAP: Record<ProviderPackProgressStep["key"], ProviderOnboardingStepKey> = {
  BASIC_INFO: "pack",
  MATERIAL: "payload",
  DISTRIBUTION: "distribution",
  REVIEW: "review",
  APPROVAL: "publish",
};

const STATUS_MAP: Record<ProviderPackProgressStep["status"], ProviderOnboardingStepStatus> = {
  COMPLETED: "done",
  CURRENT: "current",
  WAITING: "pending",
  BLOCKED: "pending",
};

/** @deprecated Prefer buildProviderPackProgress for pack-scoped workflow. */
export type BuildProviderOnboardingStepsInput = {
  hasProfile: boolean;
  packCount: number;
  sourceDocumentCount: number;
  knowledgeUnitDraftCount?: number;
  hasReviewingPack: boolean;
  hasPublishedOrVerifiedPack: boolean;
  primaryPackId?: string;
  hasPayload?: boolean;
  hasDistribution?: boolean;
  /** When set, builds steps for this pack only (preferred). */
  packScoped?: {
    packId: string;
    packStatus: PackStatus;
    name: string;
    categoryId: string;
    shortDescription: string;
    description: string;
    latestRejectionReason?: string | null;
    workingVersion: {
      id: string;
      version: string;
      sourceDocumentCount: number;
      materialReady: boolean;
      distributionReady: boolean;
    } | null;
    publishedVersion: { id: string; version: string } | null;
  };
};

function toOnboardingSteps(progress: ProviderPackProgressDto): ProviderOnboardingStep[] {
  return progress.steps.map((step) => ({
    key: STEP_KEY_MAP[step.key],
    title: step.label,
    description: step.description,
    status: STATUS_MAP[step.status],
    href: step.href ?? undefined,
  }));
}

/**
 * Pack-detail / legacy helper. Provider Center must not use account-global aggregates.
 * Prefer packScoped input; legacy aggregate fields remain for older tests only.
 */
export function buildProviderOnboardingSteps(
  input: BuildProviderOnboardingStepsInput,
): ProviderOnboardingStep[] {
  if (input.packScoped) {
    return toOnboardingSteps(buildProviderPackProgress(input.packScoped));
  }

  // Legacy aggregate path — kept for unit tests; do not use in Provider Center UI.
  const packStatus: PackStatus = input.hasPublishedOrVerifiedPack
    ? "PUBLISHED"
    : input.hasReviewingPack
      ? "REVIEWING"
      : input.packCount > 0
        ? "DRAFT"
        : "DRAFT";

  const packId = input.primaryPackId ?? "draft";
  const progress = buildProviderPackProgress({
    packId,
    packStatus: input.packCount === 0 ? "DRAFT" : packStatus,
    name: input.packCount > 0 ? "pack" : "",
    categoryId: input.packCount > 0 ? "cat" : "",
    shortDescription: input.packCount > 0 ? "short" : "",
    description: input.packCount > 0 ? "desc" : "",
    language: input.packCount > 0 ? "ko" : null,
    workingVersion:
      input.packCount > 0
        ? {
            id: "v1",
            version: "0.1.0",
            sourceDocumentCount: input.sourceDocumentCount,
            materialReady: Boolean(input.hasPayload) || input.sourceDocumentCount > 0,
            distributionReady: Boolean(input.hasDistribution),
          }
        : null,
    publishedVersion: input.hasPublishedOrVerifiedPack
      ? { id: "v1", version: "0.1.0" }
      : null,
  });

  if (input.packCount === 0) {
    return [
      {
        key: "pack",
        title: "기본정보",
        description: "지식팩 이름·카테고리·설명을 입력합니다.",
        status: "current",
        href: ROUTES.providerPackNew,
      },
      {
        key: "payload",
        title: "자료 등록",
        description: "외부 생성 도구에서 만든 지식팩 자료와 원본문서를 등록합니다.",
        status: "pending",
      },
      {
        key: "distribution",
        title: "유통정보",
        description: "출처·라이선스·공개 범위를 입력합니다.",
        status: "pending",
      },
      {
        key: "review",
        title: "검수 요청",
        description: "준비가 끝나면 검수 요청을 제출합니다.",
        status: "pending",
      },
      {
        key: "publish",
        title: "승인·공개",
        description: "운영자가 승인하면 스토어에 공개됩니다.",
        status: "pending",
      },
    ];
  }

  return toOnboardingSteps(progress).map((step) => {
    if (step.status !== "current") return step;
    if (step.key === "pack") {
      return { ...step, href: ROUTES.providerPackNew };
    }
    if (input.primaryPackId) {
      const tab =
        step.key === "payload"
          ? "payload"
          : step.key === "distribution"
            ? "distribution"
            : step.key === "review" || step.key === "publish"
              ? "review"
              : null;
      return {
        ...step,
        href: tab
          ? `${providerPackDetailPath(input.primaryPackId)}?tab=${tab}`
          : providerPackDetailPath(input.primaryPackId),
      };
    }
    return step;
  });
}

export function resolveProviderPackNextAction(input: {
  status: string;
  sourceDocumentCount: number;
  knowledgeUnitDraftCount?: number;
  justCreated: boolean;
  hasPayload?: boolean;
}): { title: string; body: string; href?: string } {
  if (input.justCreated) {
    return {
      title: "지식팩 초안 생성 완료",
      body: "기본정보를 확인한 뒤 자료를 등록하세요.",
      href: "?tab=basic",
    };
  }
  if (input.status === "DRAFT" && !input.hasPayload && input.sourceDocumentCount === 0) {
    return {
      title: "다음 할 일",
      body: "외부 생성 도구 산출물과 원본문서를 등록하세요.",
      href: "?tab=payload",
    };
  }
  if (input.status === "DRAFT") {
    return {
      title: "다음 할 일",
      body: "검수 요청을 제출하세요.",
      href: "?tab=review",
    };
  }
  if (input.status === "REVIEWING") {
    return {
      title: "검토 진행 중",
      body: "검토 요청 후 운영자가 승인·활성화하면 공개 지식팩으로 사용할 수 있습니다.",
    };
  }
  return {
    title: "지식팩 상태",
    body: "현재 지식팩 상태를 확인하세요.",
  };
}
