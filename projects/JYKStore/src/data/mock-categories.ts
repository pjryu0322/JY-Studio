/**
 * seed 호환용 Mock 카테고리 데이터입니다.
 * 사용자 화면에서는 DB 조회(pack-catalog-service)를 사용합니다.
 */
import type { StoreCategory } from "@/types/pack";

export const mockCategories: StoreCategory[] = [
  {
    categoryId: "auth",
    name: "인증",
    description: "로그인, 본인확인, SSO, 인증 API 연동 지식팩",
    icon: "🔐",
  },
  {
    categoryId: "api",
    name: "API 연동",
    description: "외부 API, REST API, Callback, Webhook 연동 지식팩",
    icon: "🔌",
  },
  {
    categoryId: "framework",
    name: "프레임워크",
    description: "전자정부프레임워크, Spring, 표준 개발환경 지식팩",
    icon: "🏛️",
  },
  {
    categoryId: "ui",
    name: "UI 컴포넌트",
    description: "그리드, 차트, 화면 컴포넌트 연동 지식팩",
    icon: "🧩",
  },
  {
    categoryId: "security",
    name: "보안",
    description: "인증, 권한, 개인정보, 보안 점검 지식팩",
    icon: "🛡️",
  },
  {
    categoryId: "public-standard",
    name: "공공 표준",
    description: "공공 정보화사업과 표준 연계에 필요한 지식팩",
    icon: "📘",
  },
  {
    categoryId: "database",
    name: "데이터베이스",
    description: "DB 설계, 쿼리, 마이그레이션, 성능 관련 지식팩",
    icon: "🗄️",
  },
  {
    categoryId: "cloud",
    name: "클라우드",
    description: "클라우드 배포, 운영, 인프라 연동 지식팩",
    icon: "☁️",
  },
  {
    categoryId: "document",
    name: "전자문서",
    description: "전자문서, 파일, PDF, 서식 처리 지식팩",
    icon: "📄",
  },
  {
    categoryId: "reporting",
    name: "리포팅",
    description: "보고서, 출력, PDF, 엑셀 다운로드 지식팩",
    icon: "📊",
  },
  {
    categoryId: "map",
    name: "지도/위치",
    description: "지도 API, 위치, 좌표, 마커 표시 지식팩",
    icon: "🗺️",
  },
  {
    categoryId: "payment",
    name: "결제",
    description: "결제 API, 승인, 취소, 정산 연동 지식팩",
    icon: "💳",
  },
];
