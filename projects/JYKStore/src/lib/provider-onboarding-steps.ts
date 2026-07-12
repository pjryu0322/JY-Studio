import { ROUTES, providerPackDetailPath } from "@/lib/routes";

export type ProviderOnboardingStepKey = "pack" | "materials" | "review" | "publish";

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
};

export function buildProviderOnboardingSteps(
  input: BuildProviderOnboardingStepsInput,
): ProviderOnboardingStep[] {
  const materialsHref = input.primaryPackId
    ? `${providerPackDetailPath(input.primaryPackId)}?tab=materials`
    : undefined;

  const packStatus: ProviderOnboardingStepStatus = input.packCount > 0 ? "done" : "current";

  let materialsStatus: ProviderOnboardingStepStatus = "pending";
  if (input.packCount > 0) {
    materialsStatus =
      input.sourceDocumentCount > 0 ? "done" : packStatus === "done" ? "current" : "pending";
  }

  let reviewStatus: ProviderOnboardingStepStatus = "pending";
  if (input.hasPublishedOrVerifiedPack) {
    reviewStatus = "done";
  } else if (input.hasReviewingPack) {
    reviewStatus = "current";
  } else if (materialsStatus === "done") {
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
      key: "materials",
      title: "기존 자료 확인",
      description: "등록된 원천 자료를 확인합니다.",
      status: materialsStatus,
      href: materialsStatus === "current" ? materialsHref : undefined,
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
}): { title: string; body: string; href?: string } {
  if (input.justCreated) {
    return {
      title: "지식팩 초안 생성 완료",
      body: "기본정보를 확인한 뒤 기존 자료와 검수 요청을 준비하세요.",
      href: "?tab=basic",
    };
  }
  if (input.status === "DRAFT" && input.sourceDocumentCount === 0) {
    return {
      title: "다음 할 일",
      body: "기존 자료를 확인하세요. 신규 내부 생성은 종료되었습니다.",
      href: "?tab=materials",
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
