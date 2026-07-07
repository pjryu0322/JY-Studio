import type { KnowledgePack } from "@/types/pack";

export const mockPacks: KnowledgePack[] = [
  {
    packId: "easy-auth",
    name: "간편인증 연동 지식팩",
    category: "인증",
    provider: "JYK Verified",
    status: "PUBLISHED",
    version: "1.0.0",
    description: "인증 요청, Callback 처리, 결과 확인, 오류코드 대응 지식을 제공합니다.",
    tags: ["간편인증", "Callback", "Java", "Spring", "API"],
    icon: "🔐",
    rating: 4.8,
    usageCount: 1240,
    isVerified: true,
    updatedAt: "2026-07-07",
  },
  {
    packId: "egov-framework",
    name: "전자정부프레임워크 지식팩",
    category: "프레임워크",
    provider: "JYK Verified",
    status: "PUBLISHED",
    version: "1.0.0",
    description: "전자정부프레임워크 기반 서비스 구현에 필요한 표준 개발 지식을 제공합니다.",
    tags: ["전자정부", "Java", "Spring", "공공"],
    icon: "🏛️",
    rating: 4.7,
    usageCount: 860,
    isVerified: true,
    updatedAt: "2026-07-05",
  },
  {
    packId: "map-api",
    name: "지도 API 지식팩",
    category: "API",
    provider: "Community",
    status: "DRAFT",
    version: "0.1.0",
    description: "지도, 위치, 좌표 변환, 마커 표시 연동 지식을 정리합니다.",
    tags: ["지도", "API", "위치", "좌표"],
    icon: "🗺️",
    rating: 0,
    usageCount: 0,
    isVerified: false,
    updatedAt: "2026-07-01",
  },
  {
    packId: "grid-solution",
    name: "그리드 솔루션 지식팩",
    category: "UI",
    provider: "Community",
    status: "REVIEWING",
    version: "0.1.0",
    description: "업무시스템에서 자주 사용하는 그리드 UI 패턴과 연동 방식을 정리합니다.",
    tags: ["UI", "Grid", "업무시스템"],
    icon: "📊",
    rating: 0,
    usageCount: 0,
    isVerified: false,
    updatedAt: "2026-07-01",
  },
  {
    packId: "reporting-solution",
    name: "리포팅 솔루션 지식팩",
    category: "리포팅",
    provider: "Community",
    status: "DRAFT",
    version: "0.1.0",
    description: "보고서 출력, 서식, PDF 생성, 엑셀 다운로드 관련 지식을 정리합니다.",
    tags: ["리포팅", "PDF", "Excel", "출력"],
    icon: "📄",
    rating: 0,
    usageCount: 0,
    isVerified: false,
    updatedAt: "2026-07-01",
  },
];

export const STORE_CATEGORIES = [
  "인증",
  "API 연동",
  "프레임워크",
  "UI 컴포넌트",
  "보안",
  "공공 표준",
  "데이터베이스",
  "클라우드",
  "전자문서",
  "리포팅",
  "지도/위치",
  "결제",
] as const;

export const POPULAR_SEARCH_TERMS = [
  "간편인증",
  "전자정부프레임워크",
  "지도 API",
  "Callback",
  "Spring Boot",
] as const;

export function getPublishedPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return packs.filter((p) => p.status === "PUBLISHED");
}

export function getQuickConnectPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return packs.filter((p) => p.status === "PUBLISHED" && p.isVerified);
}

export function getPopularPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return [...packs].sort((a, b) => b.usageCount - a.usageCount).slice(0, 4);
}

export function getNewPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return [...packs]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
}

export function getPacksByCategory(packs: readonly KnowledgePack[], category: string): KnowledgePack[] {
  const normalized = category.trim();
  return packs.filter((p) => {
    if (p.category === normalized) return true;
    if (normalized === "API 연동" && p.category === "API") return true;
    if (normalized === "UI 컴포넌트" && p.category === "UI") return true;
    if (normalized === "지도/위치" && p.category === "API" && p.packId === "map-api") return true;
    return false;
  });
}

export function countPacksInCategory(packs: readonly KnowledgePack[], category: string): number {
  return getPacksByCategory(packs, category).length;
}
