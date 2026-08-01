import {
  ADMIN_CONSOLE_TITLE,
  ADMIN_CORRECTION_QUEUE_TITLE,
  ADMIN_GENERATION_QUEUE_DESCRIPTION,
  ADMIN_GENERATION_QUEUE_TITLE,
  ADMIN_REVIEWS_LIST_TITLE,
  ADMIN_WORK_INBOX_DESCRIPTION,
  ADMIN_WORK_INBOX_TITLE,
  PROVIDER_CENTER_TAGLINE,
} from "@/lib/role-based-ux-copy";
import { parseAdminWorkQueue, ROUTES, type AdminWorkQueueKey } from "@/lib/routes";

export type StorePageChrome = {
  title: string;
  description: string;
};

function adminQueueChrome(queue: AdminWorkQueueKey): StorePageChrome {
  switch (queue) {
    case "receipt":
    case "accept":
      return { title: "자료 접수", description: ADMIN_WORK_INBOX_DESCRIPTION };
    case "knowledge-scope":
      return {
        title: "지식화 대상 확인",
        description: "지식화에 포함할 자료를 확인하고 생성을 준비합니다.",
      };
    case "generation":
    case "quality":
      return {
        title: ADMIN_GENERATION_QUEUE_TITLE,
        description: ADMIN_GENERATION_QUEUE_DESCRIPTION,
      };
    case "correction":
      return { title: ADMIN_CORRECTION_QUEUE_TITLE, description: "" };
    case "service-validation":
      return { title: "서비스 검증", description: "" };
    case "publish":
    case "provider-review":
    case "approval-publish":
      return { title: "게시", description: "" };
    case "ops":
      return { title: "공개/운영", description: "" };
    default:
      return { title: ADMIN_WORK_INBOX_TITLE, description: ADMIN_WORK_INBOX_DESCRIPTION };
  }
}

/**
 * Shared content-top chrome (title + description) for the store shell header.
 * Pages should not repeat the same h1/description block in the body.
 */
export function resolveStorePageChrome(
  pathname: string,
  search?: string | { get(name: string): string | null } | null,
): StorePageChrome {
  const queueRaw =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("queue")
      : search && typeof search.get === "function"
        ? search.get("queue")
        : null;

  if (pathname === ROUTES.home || pathname === ROUTES.today) {
    return {
      title: "투데이",
      description: "오늘 참고할 지식팩과 추천을 확인합니다.",
    };
  }
  if (pathname === ROUTES.search || pathname.startsWith(`${ROUTES.search}/`)) {
    return {
      title: "검색",
      description: "지식팩 이름·태그·설명으로 찾아봅니다.",
    };
  }
  if (pathname === ROUTES.categories) {
    return {
      title: "카테고리",
      description: "분야별로 지식팩을 살펴보고, 관리자는 상위·하위 카테고리를 관리합니다.",
    };
  }
  if (pathname.startsWith(`${ROUTES.categories}/`)) {
    return {
      title: "카테고리",
      description: "선택한 분야의 지식팩을 확인합니다.",
    };
  }
  if (pathname === ROUTES.packs) {
    return {
      title: "지식팩 둘러보기",
      description: "공개된 지식팩을 탐색하고 내 지식팩에 추가합니다.",
    };
  }
  if (pathname.startsWith(`${ROUTES.packs}/`)) {
    return {
      title: "지식팩 상세",
      description: "지식팩 소개와 이용 방법을 확인합니다.",
    };
  }
  if (pathname === ROUTES.myPacks) {
    return {
      title: "내 지식팩",
      description: "보관한 지식팩을 확인하고 연동·다운로드합니다.",
    };
  }
  if (pathname.startsWith(`${ROUTES.myPacks}/`)) {
    return {
      title: "지식팩 연결",
      description: "API Key와 연동 정보를 확인합니다.",
    };
  }
  if (pathname === ROUTES.provider) {
    return {
      title: "지식팩 제공자 센터",
      description: PROVIDER_CENTER_TAGLINE,
    };
  }
  if (pathname === ROUTES.providerReviews || pathname.startsWith(`${ROUTES.providerReviews}/`)) {
    return {
      title: "검토대상",
      description: "관리자가 생성·품질점검한 지식데이터를 검토합니다.",
    };
  }
  if (pathname === ROUTES.providerPackNew) {
    return {
      title: "지식팩 등록",
      description: "외부 Payload로 새 지식팩 초안을 등록합니다.",
    };
  }
  if (pathname.startsWith(`${ROUTES.provider}/packs/`)) {
    return {
      title: "지식팩 편집",
      description: "기본정보·자료·검색데이터·유통정보를 준비하고 검수를 요청합니다.",
    };
  }
  if (pathname === ROUTES.accountProfile) {
    return {
      title: "프로필 관리",
      description: "계정 역할과 프로필을 확인합니다. 제공자·사용자는 별도 계정입니다.",
    };
  }
  if (pathname === ROUTES.accountPlan) {
    return {
      title: "이용 플랜",
      description: "현재 플랜과 이용 한도를 확인합니다.",
    };
  }
  if (pathname === ROUTES.account) {
    return {
      title: "계정",
      description: "등록된 계정 정보와 역할을 관리합니다.",
    };
  }
  if (pathname === ROUTES.apiKeys) {
    return {
      title: "API Key 관리",
      description: "연동에 사용할 API Key를 발급합니다. Key 원문은 생성 직후 한 번만 표시됩니다.",
    };
  }
  if (pathname === ROUTES.docs) {
    return {
      title: "JYKStore 문서",
      description: "지식팩을 서비스에 연동하기 위한 API/SDK 문서입니다.",
    };
  }
  if (pathname === ROUTES.apiDocs) {
    return {
      title: "JYKStore API 개요",
      description: "Base URL, 인증 방식, API Key 보안 정책을 확인합니다.",
    };
  }
  if (pathname === ROUTES.contextApiDocs) {
    return {
      title: "Context API",
      description: "지식팩 context 조회 및 query 검색 API 문서입니다.",
    };
  }
  if (pathname === ROUTES.retrievalApiDocs) {
    return {
      title: "Metadata Retrieval API",
      description:
        "Metadata Filter 기반 Context 검색 API입니다. Keyword Ranking과 hybrid ranking을 지원합니다.",
    };
  }
  if (pathname === ROUTES.sdkDocs) {
    return {
      title: "TypeScript SDK 샘플",
      description: "fetch 기반 client 샘플 코드와 사용법입니다.",
    };
  }
  if (pathname === ROUTES.login) {
    return {
      title: "로그인",
      description: "JYKStore 계정으로 로그인합니다.",
    };
  }
  if (pathname === ROUTES.admin) {
    return adminQueueChrome(parseAdminWorkQueue(queueRaw ?? "receipt"));
  }
  if (pathname === ROUTES.adminGeneration) {
    return {
      title: ADMIN_GENERATION_QUEUE_TITLE,
      description: ADMIN_GENERATION_QUEUE_DESCRIPTION,
    };
  }
  if (pathname === ROUTES.adminReviews) {
    return {
      title: ADMIN_CONSOLE_TITLE,
      description: ADMIN_REVIEWS_LIST_TITLE,
    };
  }
  if (pathname.startsWith(`${ROUTES.adminReviews}/`)) {
    return {
      title: "지식데이터 생성 및 편집",
      description: "생성, 점검, 보정 순으로 지식데이터를 처리합니다.",
    };
  }
  if (pathname === ROUTES.adminOps) {
    return {
      title: "운영 콘솔",
      description: "API 사용량, AuditLog, Health 상태를 확인합니다.",
    };
  }
  if (pathname === ROUTES.adminOpsUsage) {
    return {
      title: "API UsageLog",
      description: "Context API 호출 로그입니다. API Key 원문은 표시되지 않으며 apiKeyId는 마스킹됩니다.",
    };
  }
  if (pathname === ROUTES.adminOpsAudit) {
    return {
      title: "AuditLog",
      description: "운영 감사 로그입니다. 식별자는 마스킹되어 표시됩니다.",
    };
  }
  if (pathname === ROUTES.adminOpsHealth) {
    return {
      title: "Health",
      description: "DB와 Context API 운영 상태를 확인합니다.",
    };
  }
  if (pathname === ROUTES.adminOpsPlans) {
    return {
      title: "Plan / Billing",
      description: "전체 무료 플랜 정책과 이용량 기준입니다.",
    };
  }
  if (pathname === ROUTES.adminOpsApiKeys) {
    return {
      title: "API Key 관리",
      description: "전체 API Key 상태·scope·만료를 확인합니다. raw key 원문은 표시되지 않습니다.",
    };
  }
  if (pathname === ROUTES.adminOpsQuota) {
    return {
      title: "Quota / Gateway",
      description: "clientId 기준 Public API 사용량과 429 QUOTA_EXCEEDED를 확인합니다.",
    };
  }

  return {
    title: "JYKStore",
    description: "AI가 참고할 제품 지식을 지식팩으로",
  };
}
