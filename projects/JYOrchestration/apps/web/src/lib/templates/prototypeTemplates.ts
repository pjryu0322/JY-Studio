export type PrototypeTemplateType = "dashboard" | "booking" | "marketplace" | "landing";

export type PrototypeTemplate = Readonly<{
  id: PrototypeTemplateType;
  nameKo: string;
  nameEn: string;
  description: string;
  keywords: readonly string[];
  navigationItems: readonly string[];
  summaryCards: readonly string[];
  primarySections: readonly string[];
  sampleActions: readonly string[];
  recommendedFor: readonly string[];
}>;

export const PROTOTYPE_TEMPLATES: readonly PrototypeTemplate[] = [
  {
    id: "dashboard",
    nameKo: "대시보드",
    nameEn: "Dashboard",
    description: "운영/관리 중심의 상태·지표를 한 화면에서 확인하고 요청을 처리하는 형태",
    keywords: ["관리자", "운영", "통계", "권한", "내부 시스템", "업무 자동화"],
    navigationItems: ["대시보드", "요청 관리", "사용자 관리", "통계", "설정"],
    summaryCards: ["승인 대기", "진행 중", "최근 요청", "사용자 수"],
    primarySections: ["최근 요청 리스트", "상태별 처리 현황", "주요 지표"],
    sampleActions: ["요청 승인", "담당자 배정", "권한 변경", "지표 확인"],
    recommendedFor: ["내부 운영툴", "업무 처리 현황", "승인/검토 흐름", "권한 분리"],
  },
  {
    id: "booking",
    nameKo: "예약",
    nameEn: "Booking",
    description: "일정/예약을 중심으로 시간 선택 → 신청 → 확인/변경 흐름을 제공하는 형태",
    keywords: ["예약", "일정", "상담", "방문", "스케줄", "접수"],
    navigationItems: ["예약하기", "예약 내역", "상담 문의", "관리자 일정"],
    summaryCards: ["오늘 예약", "가능 시간", "대기 요청", "완료 건수"],
    primarySections: ["예약 캘린더", "시간 선택", "예약 신청 폼"],
    sampleActions: ["시간 선택", "예약 신청", "예약 변경", "일정 승인"],
    recommendedFor: ["상담/방문 예약", "자원 스케줄링", "접수/확인 흐름"],
  },
  {
    id: "marketplace",
    nameKo: "마켓플레이스",
    nameEn: "Marketplace",
    description: "상품/매칭/주문을 중심으로 공급자-수요자 연결과 거래 상태를 제공하는 형태",
    keywords: ["상품", "판매", "주문", "중개", "매칭", "공급자"],
    navigationItems: ["상품 목록", "상세", "장바구니", "주문", "판매자센터"],
    summaryCards: ["등록 상품", "신규 주문", "매칭 요청", "판매자 수"],
    primarySections: ["추천 상품", "거래 현황", "판매자 관리"],
    sampleActions: ["상품 등록", "주문 처리", "매칭 승인", "정산 확인"],
    recommendedFor: ["중개/매칭 서비스", "주문/거래", "판매자 관리"],
  },
  {
    id: "landing",
    nameKo: "랜딩",
    nameEn: "Landing",
    description: "소개/가입/문의 중심의 브랜드·서비스 소개형 페이지",
    keywords: ["소개", "홍보", "가입", "사전예약", "브랜드", "회사소개"],
    navigationItems: ["소개", "기능", "가격", "문의", "가입"],
    summaryCards: ["방문자", "가입 전환", "문의 수", "캠페인"],
    primarySections: ["Hero", "핵심 기능 카드", "CTA", "문의 영역"],
    sampleActions: ["문의하기", "가입하기", "가격 보기", "데모 요청"],
    recommendedFor: ["홍보/마케팅", "사전예약", "가입 전환", "브랜드 소개"],
  },
] as const;

function normalizeText(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function recommendPrototypeTemplate(input: string): {
  templateId: PrototypeTemplateType;
  score: number;
  matchedKeywords: string[];
} {
  const text = normalizeText(input);
  if (!text) return { templateId: "dashboard", score: 0, matchedKeywords: [] };

  let best: { id: PrototypeTemplateType; matches: string[]; raw: number } = { id: "dashboard", matches: [], raw: 0 };

  for (const t of PROTOTYPE_TEMPLATES) {
    const matches: string[] = [];
    for (const kw of t.keywords) {
      const k = normalizeText(kw);
      if (!k) continue;
      if (text.includes(k)) matches.push(kw);
    }
    if (matches.length > best.raw) best = { id: t.id, matches, raw: matches.length };
  }

  if (best.raw <= 0) return { templateId: "dashboard", score: 12, matchedKeywords: [] };
  const score = Math.max(0, Math.min(100, Math.round((best.raw / 6) * 100)));
  return { templateId: best.id, score, matchedKeywords: best.matches };
}

