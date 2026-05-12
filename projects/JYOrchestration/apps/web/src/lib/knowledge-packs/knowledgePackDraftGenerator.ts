import type { KnowledgePackAgent, KnowledgePackCategory } from "@/lib/knowledge-packs/types";
import {
  PRECHECK_DECISION_LABEL,
  PRECHECK_RISK_LABEL,
  type KnowledgePackPrecheckDecision,
  type KnowledgePackPrecheckRiskLevel,
} from "@/lib/knowledge-packs/knowledgePackPrecheckTypes";

/** AI 초안 생성 입력 (향후 LLM 호출 본문으로 확장). */
export type KnowledgePackDraftInput = Readonly<{
  productName: string;
  productUrl?: string;
  category: KnowledgePackCategory;
  agents: readonly KnowledgePackAgent[];
  purpose?: string;
  officialDocsUrl?: string;
  apiDocsUrl?: string;
  repositoryUrl?: string;
  licenseHint?: string;
  memo?: string;
  /** 선택: 사전점검 직후 초안 생성 시 경고·원천자료 안내에 반영 */
  precheckDecision?: KnowledgePackPrecheckDecision;
  precheckRiskLevel?: KnowledgePackPrecheckRiskLevel;
  precheckIssues?: readonly string[];
}>;

/** Mock 초안 결과 — textarea에 그대로 넣을 수 있는 줄 단위 문자열. */
export type KnowledgePackDraftResult = Readonly<{
  summary: string;
  licenseNotes: string;
  recommendedUseCases: string;
  notRecommendedUseCases: string;
  capabilities: string;
  constraints: string;
  implementationGuidelines: string;
  cursorPromptRules: string;
  forbiddenPatterns: string;
  reviewChecklist: string;
  securityChecklist: string;
  alternatives: string;
  references: string;
  previewSpec: string;
  sourceCandidates: string;
  warnings: readonly string[];
}>;

function refLine(label: string, url: string | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  return `${label} | ${u}`;
}

function buildReferences(input: KnowledgePackDraftInput): string {
  const lines: string[] = [];
  const push = (s: string | null) => {
    if (s) lines.push(s);
  };
  push(refLine("공식 제품 URL", input.productUrl));
  push(refLine("공식 문서 URL", input.officialDocsUrl));
  push(refLine("API 문서 URL", input.apiDocsUrl));
  push(refLine("GitHub/npm URL", input.repositoryUrl));
  return lines.join("\n");
}

function baseWarnings(): string[] {
  return [
    "AI가 생성한 라이선스·보안·API Key·개인정보 관련 내용은 반드시 사용자가 공식 문서 기준으로 확인해야 합니다.",
    "Secret, API Key, Access Token, Refresh Token, Client Secret, 개인정보 수집/저장, 외부 스크립트/CDN, 상용 라이선스·서비스 약관은 보안·법무 검토 대상입니다.",
  ];
}

function gridDraft(name: string, purpose: string | undefined): Omit<KnowledgePackDraftResult, "references" | "warnings" | "sourceCandidates"> {
  const p = purpose?.trim() || "업무용 목록·조회 화면";
  return {
    summary: `${name}는(은) 업무용 데이터 그리드 구현 후보입니다. Mock 초안이며 실제 제품 동작·라이선스는 공식 문서로 확인해야 합니다. 사용 목적: ${p}.`,
    licenseNotes: ["제품 공식 라이선스·배포 조건을 반드시 확인한다.", "Community/Enterprise 등 에디션 구분이 있으면 명시한다."].join("\n"),
    recommendedUseCases: [
      "업무용 목록 화면에 정렬·필터·페이지네이션이 필요한 경우",
      "조회 조건 영역과 결과 Grid를 분리해 설계하는 경우",
      `${name}를 AI개발자 구현 기준으로 문서화하려는 경우`,
    ].join("\n"),
    notRecommendedUseCases: [
      "공식 문서·버전·Wrapper 호환성 확인 없이 운영 배포하려는 경우",
      "단순 HTML table로 충분한데 과도한 Grid를 도입하려는 경우",
    ].join("\n"),
    capabilities: ["정렬", "필터", "페이지네이션", "행 선택", "상태 컬럼", "조회 조건 UI"].join("\n"),
    constraints: [
      "단순 HTML table만으로 Grid 요구를 대체하지 않는다.",
      "React 적용 시 wrapper·생명주기·CSS 로딩은 공식 가이드를 따른다.",
      "CDN·외부 스크립트는 보안·망분리 정책에 맞게 검토한다.",
    ].join("\n"),
    implementationGuidelines: [
      "조회 조건, Grid, 페이지네이션, 로딩/빈 상태를 한 화면 흐름으로 설계한다.",
      "샘플 데이터는 5~20행 수준이되 업무 목록처럼 읽히게 구성한다.",
      "프로토타입에서는 라이브러리 미설치 시 Preview Mock으로 UX만 검증할 수 있다.",
    ].join("\n"),
    cursorPromptRules: [
      `${name} 관련 작업 시 본 지식팩을 참조한다.`,
      "업무용 Grid 구조(조회·목록·정렬·필터)를 범위에 포함한다.",
      "공식 API 이름·옵션은 문서 확인 후 사용하도록 지시한다.",
    ].join("\n"),
    forbiddenPatterns: [
      "공식 문서 없이 API·옵션명을 임의로 만들지 않는다.",
      "단순 table만 두고 Grid 특성을 충족했다고 단정하지 않는다.",
      "라이선스 미확인 상태에서 상용 배포 전제 코드를 작성하지 않는다.",
    ].join("\n"),
    reviewChecklist: [
      "업무용 Grid 레이아웃인가",
      "정렬·필터·페이지네이션이 반영되었는가",
      "단순 table로 끝나지 않았는가",
      "Mock 적용 여부가 명확한가",
    ].join("\n"),
    securityChecklist: ["외부 스크립트·CDN 삽입 전 보안 검토", "의존성 버전·CVE 점검"].join("\n"),
    alternatives: ["AG Grid Community", "TanStack Table 기반 그리드", "Tabulator", "기타 벤더 Grid(라이선스 보유 시)"].join("\n"),
    previewSpec: ["kind: grid-mock", `title: ${name}`, "notes: 라이브러리 미적용 시 플랫폼 Preview Mock 사용"].join("\n"),
  };
}

function authDraft(name: string, purpose: string | undefined): Omit<KnowledgePackDraftResult, "references" | "warnings" | "sourceCandidates"> {
  const p = purpose?.trim() || "OAuth 기반 로그인·연동";
  return {
    summary: `${name}는(은) 인증·연동 흐름을 정의하는 지식팩 초안(Mock)입니다. ${p}. 실제 토큰·Secret 처리는 서버에서만 수행합니다.`,
    licenseNotes: ["외부 IdP·플랫폼 약관 및 개인정보 처리방침을 확인한다.", "동의항목·검수 요건이 서비스 유형에 따라 다를 수 있다."].join("\n"),
    recommendedUseCases: ["소셜/기업 로그인 UX가 필요한 경우", "Redirect·Callback·세션 연계를 명확히 하려는 경우"].join("\n"),
    notRecommendedUseCases: ["Redirect URI·앱 키 설정 없이 실연동으로 가정하는 경우", "Client Secret·Refresh Token을 프론트에 두려는 경우"].join("\n"),
    capabilities: ["로그인 시작", "OAuth 인가", "Callback 처리", "토큰 교환(서버)", "사용자 정보 조회", "로그아웃·연결 끊기 구분", "실패·취소·만료 시나리오"].join("\n"),
    constraints: ["Access/Refresh Token·Client Secret은 프론트에 노출하지 않는다.", "Redirect URI는 등록값과 정확히 일치해야 한다."].join("\n"),
    implementationGuidelines: [
      "Simulator / SANDBOX / REAL 모드로 외부 호출부를 분리할 수 있게 설계한다.",
      "인증 성공 후 내부 세션·회원 상태 반영 흐름을 문서화한다.",
    ].join("\n"),
    cursorPromptRules: [
      `${name} 작업 시 OAuth 흐름으로 설계하도록 지시한다.`,
      "Secret·토큰은 서버 환경변수 또는 Secret 저장소만 사용하도록 명시한다.",
    ].join("\n"),
    forbiddenPatterns: [
      "Client Secret·장기 Access Token을 localStorage 등 프론트 저장소에 두지 않는다.",
      "Redirect URI 미설정인데 연동 완료로 취급하지 않는다.",
      "로그아웃과 연결 끊기를 동일 기능으로 혼동하지 않는다.",
    ].join("\n"),
    reviewChecklist: ["Callback이 서버(또는 안전한 BFF)에서 처리되는가", "실패·취소 UX가 있는가", "Simulator 여부가 명확한가"].join("\n"),
    securityChecklist: ["Secret·API Key 하드코딩 금지", "개인정보 필드 저장 시 동의·목적 명시"].join("\n"),
    alternatives: ["자체 ID/PW", "사내 SSO", "OAuth 일반", "기타 소셜 로그인"].join("\n"),
    previewSpec: ["kind: auth-mock", `title: ${name}`, "mode: SIMULATOR"].join("\n"),
  };
}

function apiIntegrationDraft(name: string, purpose: string | undefined): Omit<KnowledgePackDraftResult, "references" | "warnings" | "sourceCandidates"> {
  const p = purpose?.trim() || "REST 연동";
  return {
    summary: `${name} — API·연동 지식팩 Mock 초안. ${p}. Base URL·인증·에러 시나리오는 공식 명세로 검증합니다.`,
    licenseNotes: ["API 이용 약관·Rate limit·인증 방식을 확인한다."].join("\n"),
    recommendedUseCases: ["REST/JSON 연동", "타임아웃·재시도 정책이 필요한 경우", "에러 코드별 사용자 메시지 매핑"].join("\n"),
    notRecommendedUseCases: ["명세 없이 endpoint·스키마를 추측하는 경우", "인증 토큰을 로그·프론트에 노출하는 경우"].join("\n"),
    capabilities: ["Base URL", "Endpoint", "Request/Response 예시", "에러·타임아웃·재시도", "인증 헤더·Secret 관리"].join("\n"),
    constraints: ["실제 호출 전 Sandbox·Mock으로 계약 검증", "PII는 필드 단위 최소 수집"].join("\n"),
    implementationGuidelines: ["OpenAPI 또는 공식 문서의 예제를 우선 따른다.", "Simulator로 회로 차단 테스트를 권장한다."].join("\n"),
    cursorPromptRules: ["공식 스키마·에러 코드를 확인하도록 지시한다.", "Secret은 설정·KeyVault 등으로 분리한다."].join("\n"),
    forbiddenPatterns: ["임의 HTTP 상태·본문 형식을 단정하지 않는다.", "운영 키를 소스에 박지 않는다."].join("\n"),
    reviewChecklist: ["에러·타임아웃 시나리오가 있는가", "인증 방식이 문서와 일치하는가"].join("\n"),
    securityChecklist: ["API Key·Bearer 토큰 노출 방지", "로그에 민감정보 마스킹"].join("\n"),
    alternatives: ["GraphQL", "이벤트/Webhook", "배치 파일 연동"].join("\n"),
    previewSpec: ["kind: api-mock", `title: ${name}`].join("\n"),
  };
}

function genericDraft(name: string, category: KnowledgePackCategory, purpose: string | undefined): Omit<KnowledgePackDraftResult, "references" | "warnings" | "sourceCandidates"> {
  const p = purpose?.trim() || "플랫폼 지식 기준";
  return {
    summary: `${name} (${category}) — 일반 Mock 초안. ${p}. 공식 문서를 반드시 대조합니다.`,
    licenseNotes: ["라이선스·사용 조건을 제품 공식 페이지에서 확인한다."].join("\n"),
    recommendedUseCases: [`${name} 관련 구현·검수 기준이 필요한 경우`].join("\n"),
    notRecommendedUseCases: ["근거 없는 기능·수치를 단정하는 경우"].join("\n"),
    capabilities: ["요구사항 정리", "리스크·제약 식별", "참고 링크 유지"].join("\n"),
    constraints: ["카테고리에 맞는 보안·라이선스 원칙을 준수한다."].join("\n"),
    implementationGuidelines: ["프로토타입과 운영 범위를 구분해 기술한다."].join("\n"),
    cursorPromptRules: [`${name} 작업 시 본 지식팩을 참고하도록 안내한다.`].join("\n"),
    forbiddenPatterns: ["검증되지 않은 외부 주장을 사실처럼 쓰지 않는다."].join("\n"),
    reviewChecklist: ["목적·범위·비기능이 명확한가"].join("\n"),
    securityChecklist: ["기본 보안 체크리스트를 제품 유형에 맞게 보완한다."].join("\n"),
    alternatives: ["유사 제품·대체 접근을 비교한다."].join("\n"),
    previewSpec: ["kind: generic-mock", `category: ${category}`].join("\n"),
  };
}

function sourceCandidatesBlock(input: KnowledgePackDraftInput): string {
  const lines = [
    "원천자료 후보",
    "- 공식 제품 URL",
    "- 공식 문서 URL",
    "- API 문서 URL",
    "- GitHub/npm URL",
    "- 라이선스 문서",
    "",
    "입력값 기준 후보:",
  ];
  if (input.productUrl?.trim()) lines.push(`  · 제품: ${input.productUrl.trim()}`);
  if (input.officialDocsUrl?.trim()) lines.push(`  · 문서: ${input.officialDocsUrl.trim()}`);
  if (input.apiDocsUrl?.trim()) lines.push(`  · API: ${input.apiDocsUrl.trim()}`);
  if (input.repositoryUrl?.trim()) lines.push(`  · 저장소: ${input.repositoryUrl.trim()}`);
  if (input.licenseHint?.trim()) lines.push(`  · 라이선스 힌트: ${input.licenseHint.trim()}`);
  lines.push("");
  lines.push("현재는 원천자료 후보만 저장합니다. 문서 파싱, 청크 분할, 임베딩, 벡터저장소 저장은 다음 단계에서 제공됩니다.");
  return lines.join("\n");
}

function precheckDraftWarnings(input: KnowledgePackDraftInput): string[] {
  if (!input.precheckDecision) return [];
  const d = input.precheckDecision;
  const r = input.precheckRiskLevel;
  const out: string[] = [
    `[사전점검] 판정: ${PRECHECK_DECISION_LABEL[d]}${r ? `, 위험도: ${PRECHECK_RISK_LABEL[r]}` : ""}`,
  ];
  if (d === "LIMITED_REGISTERABLE") {
    out.push("[사전점검] 라이선스·약관·보안 관점에서 추가 검토 후 저장·활성화할 것을 권장합니다.");
  }
  if (d === "USER_SOURCE_REQUIRED") {
    out.push("[사전점검] 공개 URL이 부족합니다. 내부 매뉴얼·API 명세(PDF/Markdown)를 원천자료로 추가한 뒤 RAG 수집을 진행하는 것이 좋습니다.");
  }
  if (d === "NOT_RECOMMENDED") {
    out.push("[사전점검] 등록 비권장 판정입니다. 공식 문서·목적을 보강한 뒤 다시 점검하세요.");
  }
  for (const line of input.precheckIssues ?? []) {
    const t = line.trim();
    if (t) out.push(`[사전점검 이슈] ${t}`);
  }
  return out;
}

function precheckSourceCandidatesSuffix(input: KnowledgePackDraftInput): string {
  if (input.precheckDecision !== "USER_SOURCE_REQUIRED") return "";
  return "\n\n[사전점검 · 사용자 원천자료]\n공식 공개 문서만으로는 부족할 수 있습니다.\n- 내부 설계서·매뉴얼\n- 비공개 API 명세(Swagger export, PDF)\n위 자료를 원천자료로 등록한 뒤 텍스트 추출·청크 파이프라인을 실행하세요.";
}

function draftBodyWithoutMeta(
  category: KnowledgePackCategory,
  name: string,
  purpose: string | undefined
): Omit<KnowledgePackDraftResult, "references" | "warnings" | "sourceCandidates"> {
  switch (category) {
    case "GRID":
      return gridDraft(name, purpose);
    case "AUTH":
      return authDraft(name, purpose);
    case "API":
    case "INTEGRATION":
      return apiIntegrationDraft(name, purpose);
    default:
      return genericDraft(name, category, purpose);
  }
}

/**
 * 실제 LLM 호출 없이 지식팩 초안을 생성한다. 동일 시그니처로 OpenAI 연동 구현체를 끼울 수 있다.
 */
export function generateKnowledgePackDraftMock(input: KnowledgePackDraftInput): KnowledgePackDraftResult {
  const name = input.productName.trim();
  const body = draftBodyWithoutMeta(input.category, name, input.purpose);

  const references = buildReferences(input);
  const warnings = [...baseWarnings()];
  const memoTrim = input.memo?.trim();
  if (memoTrim) {
    warnings.push(`추가 메모 반영 필요: ${memoTrim.slice(0, 200)}${memoTrim.length > 200 ? "…" : ""}`);
  }

  for (const w of precheckDraftWarnings(input)) {
    if (!warnings.includes(w)) warnings.push(w);
  }

  return {
    ...body,
    references,
    warnings,
    sourceCandidates: sourceCandidatesBlock(input) + precheckSourceCandidatesSuffix(input),
  };
}
