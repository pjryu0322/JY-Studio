import type { KnowledgePack } from "@/types/knowledge-pack";

export const MOCK_KNOWLEDGE_PACKS: readonly KnowledgePack[] = [
  {
    packId: "easy-auth",
    name: "간편인증 연동 지식팩",
    category: "인증",
    provider: "JYK Verified",
    verified: true,
    status: "PUBLISHED",
    version: "1.0.0",
    tags: ["간편인증", "Callback", "Java", "Spring", "API"],
    description: "인증 요청, Callback 처리, 결과 확인, 오류코드 대응 지식을 제공합니다.",
    rating: 4.8,
    usageCount: 12840,
    iconLabel: "인증",
  },
  {
    packId: "egov-framework",
    name: "전자정부프레임워크 지식팩",
    category: "프레임워크",
    provider: "JYK Verified",
    verified: true,
    status: "PUBLISHED",
    version: "1.0.0",
    tags: ["eGov", "Spring", "공공", "표준"],
    description: "전자정부 표준프레임워크 기반 개발·배포·보안 가이드를 제공합니다.",
    rating: 4.6,
    usageCount: 9320,
    iconLabel: "eGov",
  },
  {
    packId: "map-api",
    name: "지도 API 지식팩",
    category: "API",
    status: "DRAFT",
    version: "0.1.0",
    tags: ["지도", "좌표", "REST"],
    description: "지도 SDK 연동, 좌표 변환, 마커·경로 API 사용 패턴을 정리합니다.",
    rating: 4.2,
    usageCount: 210,
    iconLabel: "지도",
  },
  {
    packId: "grid-solution",
    name: "그리드 솔루션 지식팩",
    category: "UI",
    status: "REVIEWING",
    version: "0.1.0",
    tags: ["그리드", "테이블", "페이징"],
    description: "대용량 그리드 구성, 편집·필터·엑셀 연동 패턴을 제공합니다.",
    rating: 4.0,
    usageCount: 540,
    iconLabel: "Grid",
  },
  {
    packId: "reporting-solution",
    name: "리포팅 솔루션 지식팩",
    category: "리포팅",
    status: "DRAFT",
    version: "0.1.0",
    tags: ["리포트", "PDF", "템플릿"],
    description: "리포트 템플릿 설계, 데이터 바인딩, PDF·Excel 출력 가이드를 제공합니다.",
    rating: 3.9,
    usageCount: 180,
    iconLabel: "Report",
  },
] as const;

export function getPublishedPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return packs.filter((p) => p.status === "PUBLISHED");
}

export function getQuickConnectPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return packs.filter((p) => p.status === "PUBLISHED" && p.verified);
}

export function getPopularPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return [...packs].sort((a, b) => b.usageCount - a.usageCount).slice(0, 4);
}

export function getNewPacks(packs: readonly KnowledgePack[]): KnowledgePack[] {
  return [...packs].sort((a, b) => b.version.localeCompare(a.version)).slice(0, 3);
}

export function getPacksByCategory(packs: readonly KnowledgePack[], category: string): KnowledgePack[] {
  return packs.filter((p) => p.category === category);
}

export const STORE_CATEGORIES = ["인증", "프레임워크", "API", "UI", "리포팅"] as const;
