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
}>;

export const PROTOTYPE_TEMPLATES: readonly PrototypeTemplate[] = [
  {
    id: "dashboard",
    nameKo: "대시보드",
    nameEn: "Dashboard",
    description: "내부 운영·처리 현황을 한눈에 보는 형태",
    keywords: ["관리자", "운영", "통계", "권한", "업무", "내부", "회의록", "녹취", "문서", "워크플로", "파이프라인"],
    navigationItems: ["대시보드", "요청 관리", "사용자 관리", "통계", "설정"],
    summaryCards: ["승인 대기", "진행 중", "최근 요청", "사용자 수"],
    primarySections: ["최근 요청 리스트", "상태별 처리 현황", "주요 지표"],
  },
  {
    id: "booking",
    nameKo: "예약",
    nameEn: "Booking",
    description: "예약/일정 기반으로 시간 선택 → 신청 → 확인/변경 흐름을 제공하는 형태",
    keywords: ["예약", "일정", "상담", "방문", "스케줄", "접수"],
    navigationItems: ["예약하기", "예약 내역", "상담 문의", "관리자 일정"],
    summaryCards: ["오늘 예약", "가능 시간", "대기 요청", "완료 건수"],
    primarySections: ["예약 캘린더", "시간 선택", "예약 신청 폼"],
  },
  {
    id: "marketplace",
    nameKo: "마켓플레이스",
    nameEn: "Marketplace",
    description: "상품/매칭/주문을 중심으로 공급자-수요자 연결과 거래 상태를 제공하는 형태",
    keywords: ["상품", "판매", "주문", "매칭", "중개", "공급자"],
    navigationItems: ["상품 목록", "상세", "장바구니", "주문", "판매자센터"],
    summaryCards: ["등록 상품", "신규 주문", "매칭 요청", "판매자 수"],
    primarySections: ["추천 상품", "거래 현황", "판매자 관리"],
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
  },
] as const;

function normalize(text: string): string {
  return String(text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export type PrototypeRecommendationContext = Readonly<{
  projectName?: string;
  projectDescription?: string;
  ideationAssets?: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  flowStepTitles?: readonly string[];
  actorNames?: readonly string[];
}>;

/** 서비스 흐름·아이디어 자산·액터까지 합쳐 템플릿 추천에 사용하는 코퍼스 */
export function buildPrototypeRecommendationCorpus(ctx: PrototypeRecommendationContext): string {
  const parts: string[] = [];
  if (ctx.projectName) parts.push(ctx.projectName);
  if (ctx.projectDescription) parts.push(ctx.projectDescription);
  for (const a of ctx.ideationAssets ?? []) {
    if (a.type) parts.push(a.type);
    if (a.title) parts.push(a.title);
    if (a.content) parts.push(String(a.content).slice(0, 4000));
  }
  for (const t of ctx.flowStepTitles ?? []) parts.push(t);
  for (const n of ctx.actorNames ?? []) parts.push(n);
  return parts.join("\n");
}

export function recommendPrototypeTemplateFromContext(ctx: PrototypeRecommendationContext): {
  templateId: PrototypeTemplateType;
  score: number;
  matchedKeywords: string[];
} {
  return recommendPrototypeTemplate(buildPrototypeRecommendationCorpus(ctx));
}

export function recommendPrototypeTemplate(input: string): {
  templateId: PrototypeTemplateType;
  score: number;
  matchedKeywords: string[];
} {
  const text = normalize(input);
  if (!text) return { templateId: "dashboard", score: 0, matchedKeywords: [] };

  // Priority keyword buckets (explicit rules requested).
  const ruleOrder: Array<{ id: PrototypeTemplateType; keywords: readonly string[] }> = [
    { id: "booking", keywords: ["예약", "일정", "상담"] },
    { id: "marketplace", keywords: ["상품", "판매", "주문", "매칭"] },
    { id: "landing", keywords: ["소개", "홍보", "가입", "사전예약"] },
    { id: "dashboard", keywords: ["관리자", "운영", "통계", "권한", "업무", "회의록", "녹취", "문서", "워크플로", "승인", "배포"] },
  ];
  for (const r of ruleOrder) {
    const matched = r.keywords.filter((k) => text.includes(normalize(k)));
    if (matched.length) return { templateId: r.id, score: Math.min(100, 60 + matched.length * 10), matchedKeywords: [...matched] };
  }

  // Fallback: match template keyword sets.
  let best: { id: PrototypeTemplateType; matches: string[] } = { id: "dashboard", matches: [] };
  for (const t of PROTOTYPE_TEMPLATES) {
    const matches = t.keywords.filter((k) => text.includes(normalize(k)));
    if (matches.length > best.matches.length) best = { id: t.id, matches: [...matches] };
  }
  const score = best.matches.length ? Math.min(100, Math.round((best.matches.length / 6) * 100)) : 12;
  return { templateId: best.id, score, matchedKeywords: best.matches };
}

