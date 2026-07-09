import { ROUTES, providerPackDetailPath } from "@/lib/routes";

export type ProviderOnboardingStepKey = "profile" | "pack" | "source" | "draft" | "review";

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
  knowledgeUnitDraftCount: number;
  hasReviewingPack: boolean;
  hasPublishedOrVerifiedPack: boolean;
  primaryPackId?: string;
};

export function buildProviderOnboardingSteps(
  input: BuildProviderOnboardingStepsInput,
): ProviderOnboardingStep[] {
  const packHref = input.primaryPackId ? providerPackDetailPath(input.primaryPackId) : ROUTES.providerPackNew;
  const githubHref = input.primaryPackId
    ? `${providerPackDetailPath(input.primaryPackId)}#github-auto-collect`
    : undefined;

  const profileStatus: ProviderOnboardingStepStatus = input.hasProfile ? "done" : "current";

  let packStatus: ProviderOnboardingStepStatus = "pending";
  if (input.hasProfile) {
    packStatus = input.packCount > 0 ? "done" : "current";
  }

  let sourceStatus: ProviderOnboardingStepStatus = "pending";
  if (input.packCount > 0) {
    sourceStatus =
      input.sourceDocumentCount > 0 ? "done" : packStatus === "done" ? "current" : "pending";
  }

  let draftStatus: ProviderOnboardingStepStatus = "pending";
  if (input.sourceDocumentCount > 0) {
    draftStatus =
      input.knowledgeUnitDraftCount > 0
        ? "done"
        : sourceStatus === "done"
          ? "current"
          : "pending";
  }

  let reviewStatus: ProviderOnboardingStepStatus = "pending";
  if (input.hasPublishedOrVerifiedPack) {
    reviewStatus = "done";
  } else if (input.hasReviewingPack) {
    reviewStatus = "current";
  } else if (draftStatus === "done") {
    reviewStatus = "current";
  }

  return [
    {
      key: "profile",
      title: "제공자 프로필 등록",
      description: "제공자 정보를 등록합니다.",
      status: profileStatus,
      href: input.hasProfile ? undefined : `${ROUTES.accountProfile}#provider-profile`,
    },
    {
      key: "pack",
      title: "지식팩 기본정보 입력",
      description: "지식팩 초안의 이름과 설명을 입력합니다.",
      status: packStatus,
      href: packStatus === "current" ? ROUTES.providerPackNew : undefined,
    },
    {
      key: "source",
      title: "GitHub/문서 자동수집",
      description: "공개 GitHub 또는 문서를 등록합니다.",
      status: sourceStatus,
      href: sourceStatus === "current" ? githubHref : undefined,
    },
    {
      key: "draft",
      title: "초안 확인 및 검토 요청",
      description: "Knowledge Unit 초안을 확인하고 검수를 요청합니다.",
      status: draftStatus,
      href:
        draftStatus === "current" && input.primaryPackId
          ? `${providerPackDetailPath(input.primaryPackId)}#pack-review`
          : undefined,
    },
    {
      key: "review",
      title: "운영자 승인 후 공개",
      description: "검토 요청 후 운영자가 승인·활성화하면 공개됩니다.",
      status: reviewStatus,
    },
  ];
}

export function resolveProviderPackNextAction(input: {
  status: string;
  sourceDocumentCount: number;
  knowledgeUnitDraftCount: number;
  justCreated: boolean;
}): { title: string; body: string; href?: string } {
  if (input.justCreated) {
    return {
      title: "지식팩 초안 생성 완료",
      body: "GitHub URL 또는 문서를 등록해 자동수집을 실행하세요.",
      href: "#github-auto-collect",
    };
  }
  if (input.status === "DRAFT" && input.sourceDocumentCount === 0) {
    return {
      title: "다음 할 일",
      body: "GitHub URL 또는 문서를 등록해 자동수집을 실행하세요.",
      href: "#github-auto-collect",
    };
  }
  if (input.status === "DRAFT" && input.sourceDocumentCount > 0 && input.knowledgeUnitDraftCount === 0) {
    return {
      title: "다음 할 일",
      body: "자동수집으로 Knowledge Unit 초안을 생성하거나 초안을 확인하세요.",
      href: "#github-auto-collect",
    };
  }
  if (input.status === "DRAFT" && input.knowledgeUnitDraftCount > 0) {
    return {
      title: "다음 할 일",
      body: "초안을 확인한 뒤 검수 요청을 제출하세요.",
      href: "#pack-review",
    };
  }
  if (input.status === "REVIEWING") {
    return {
      title: "검토 진행 중",
      body: "검토 요청 후 운영자가 승인·활성화하면 공개 지식팩으로 사용할 수 있습니다.",
    };
  }
  if (input.status === "PUBLISHED" || input.status === "VERIFIED") {
    return {
      title: "공개됨",
      body: "운영자 승인이 완료된 지식팩입니다. 스토어에서 검색·연동할 수 있습니다.",
    };
  }
  return {
    title: "다음 할 일",
    body: "지식팩 기본정보를 입력해 초안을 생성하세요.",
  };
}
