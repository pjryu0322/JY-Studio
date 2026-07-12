import { providerPackDetailPath, ROUTES } from "@/lib/routes";

export type ProviderOnboardingStepKey = "pack" | "payload" | "distribution" | "review" | "publish";

export type ProviderOnboardingStepStatus = "done" | "current" | "pending";

export type ProviderOnboardingStep = {
  key: ProviderOnboardingStepKey;
  title: string;
  description: string;
  status: ProviderOnboardingStepStatus;
  href?: string;
};

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
};

export function buildProviderOnboardingSteps(
  input: BuildProviderOnboardingStepsInput,
): ProviderOnboardingStep[] {
  const payloadHref = input.primaryPackId
    ? `${providerPackDetailPath(input.primaryPackId)}?tab=payload`
    : ROUTES.providerPackNew;
  const distributionHref = input.primaryPackId
    ? `${providerPackDetailPath(input.primaryPackId)}?tab=distribution`
    : undefined;

  const packStatus: ProviderOnboardingStepStatus = input.packCount > 0 ? "done" : "current";

  let payloadStatus: ProviderOnboardingStepStatus = "pending";
  if (input.packCount > 0) {
    payloadStatus =
      input.hasPayload || input.sourceDocumentCount > 0
        ? "done"
        : packStatus === "done"
          ? "current"
          : "pending";
  }

  let distributionStatus: ProviderOnboardingStepStatus = "pending";
  if (payloadStatus === "done") {
    distributionStatus = input.hasDistribution ? "done" : "current";
  }

  let reviewStatus: ProviderOnboardingStepStatus = "pending";
  if (input.hasPublishedOrVerifiedPack) {
    reviewStatus = "done";
  } else if (input.hasReviewingPack) {
    reviewStatus = "current";
  } else if (distributionStatus === "done" || (payloadStatus === "done" && input.sourceDocumentCount > 0)) {
    reviewStatus = "current";
  }

  let publishStatus: ProviderOnboardingStepStatus = "pending";
  if (input.hasPublishedOrVerifiedPack) {
    publishStatus = "done";
  } else if (input.hasReviewingPack) {
    publishStatus = "pending";
  }

  return [
    {
      key: "pack",
      title: "지식팩 기본정보 입력",
      description: "지식팩 초안의 이름과 설명을 입력합니다.",
      status: packStatus,
      href: packStatus === "current" ? ROUTES.providerPackNew : undefined,
    },
    {
      key: "payload",
      title: "Payload 등록",
      description: "외부 도구에서 생성한 ZIP을 등록합니다.",
      status: payloadStatus,
      href: payloadStatus === "current" ? payloadHref : undefined,
    },
    {
      key: "distribution",
      title: "유통정보",
      description: "출처·라이선스·이용조건을 입력합니다.",
      status: distributionStatus,
      href: distributionStatus === "current" ? distributionHref : undefined,
    },
    {
      key: "review",
      title: "검수 요청",
      description: "준비가 끝나면 검수 요청을 제출합니다.",
      status: reviewStatus === "done" ? "done" : reviewStatus,
      href:
        reviewStatus === "current" && input.primaryPackId
          ? `${providerPackDetailPath(input.primaryPackId)}?tab=review`
          : undefined,
    },
    {
      key: "publish",
      title: "운영자 승인 후 공개",
      description: "운영자가 승인하면 스토어에 공개됩니다.",
      status: publishStatus,
    },
  ];
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
      body: "기본정보를 확인한 뒤 Payload를 등록하세요.",
      href: "?tab=basic",
    };
  }
  if (input.status === "DRAFT" && !input.hasPayload && input.sourceDocumentCount === 0) {
    return {
      title: "다음 할 일",
      body: "외부 Payload ZIP을 등록하세요.",
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
