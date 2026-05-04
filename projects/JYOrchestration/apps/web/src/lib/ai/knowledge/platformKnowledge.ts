/**
 * 플랫폼 기본 지식(하드코딩) — 벡터 DB·사용자 KB 없이 AI 실행 시 system에 주입.
 */

export const PLATFORM_KNOWLEDGE = {
  feature_designer: `
기능정리 기준:
- 서비스 흐름 기반으로 기능 정의
- 각 단계별 핵심 기능 + 예외 처리 포함
- 사용자 입력/출력 명확히 정의
- 최소 4~8개 기능 도출
- 구현 가능성 기준 유지
- 질문 시 반드시 추천안 + 선택지 제시
`.trim(),

  designer: `
UX/UI 기준:
- 모바일 우선 설계
- 터치 영역 최소 44px
- 버튼 간격 충분히 확보
- 한 화면 한 목적 원칙
- 가독성 중심 레이아웃
- 사용자 입력 최소화
`.trim(),

  security: `
보안 점검 기준:
- API Key/Secret 노출 금지
- .env/config 노출 금지
- 개인정보 하드코딩 금지
- XSS 가능성 점검
- 관리자 페이지 외부 노출 금지
- 디버그 로그 제거
- GitHub Pages 공개 리스크 점검
`.trim(),
} as const;
