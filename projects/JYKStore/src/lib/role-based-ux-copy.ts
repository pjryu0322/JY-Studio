/** Account / Provider role UX copy (testable without React). */

export const ACCOUNT_GUEST_TITLE = "게스트 모드";
export const ACCOUNT_GUEST_DESCRIPTION =
  "현재 기기 기준으로 테스트 중입니다. 로그인 기능은 다음 단계에서 제공됩니다.";

export const ACCOUNT_SECTION_BASIC = "기본 사용";
export const ACCOUNT_SECTION_ROLES = "내 역할";
export const ACCOUNT_SECTION_ROLE_REGISTRATION = "역할 계정 등록";
export const ACCOUNT_SECTION_ROLE_MENUS = "사용자 메뉴";
export const ACCOUNT_SECTION_SETTINGS = "설정";

export const PROVIDER_CENTER_ONBOARDING_STEPS = [
  "제공자 프로필 등록",
  "지식팩 초안 생성",
  "GitHub URL 또는 문서 기반 자동수집",
  "검토 요청",
  "운영자 승인 후 공개",
] as const;

export const PROVIDER_PROFILE_FOOTER_HINT = "프로필 등록 후 새 지식팩을 만들 수 있습니다.";

export const PROVIDER_PACK_STATUS_UX: Record<string, string> = {
  DRAFT: "초안 작성 중",
  REVIEWING: "검토 요청됨",
  PUBLISHED: "공개됨",
  VERIFIED: "검증됨",
};
