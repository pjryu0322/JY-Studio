import type {
  KnowledgePackPrecheckInput,
  KnowledgePackPrecheckIssue,
  KnowledgePackPrecheckIssueType,
  KnowledgePackPrecheckResult,
  KnowledgePackPrecheckRiskLevel,
} from "@/lib/knowledge-packs/knowledgePackPrecheckTypes";
import type { KnowledgePackCategory } from "@/lib/knowledge-packs/types";

const AUTH_KW = /\b(login|oauth|auth|sso|token|secret|client\s*secret|redirect|인증|로그인|토큰)\b/i;
const PAY_KW = /\b(payment|결제|pg|카드|계좌|금융|인증서|금융인증|오픈뱅킹|bank|fintech)\b/i;
const PII_KW = /(개인정보|주민번호|휴대폰|전화번호|이메일|email|user\s*profile|사용자정보)/i;
const LIC_KW = /\b(enterprise|commercial|license|라이선스|상용|유료|vendor|벤더)\b/i;
const MAL_KW = /(불법|라이선스\s*회피|크랙|무단\s*배포)/i;

function combinedText(input: KnowledgePackPrecheckInput): string {
  return [
    input.productName,
    input.purpose,
    input.memo,
    input.licenseHint,
    input.category,
    input.productUrl,
    input.officialDocsUrl,
    input.apiDocsUrl,
    input.repositoryUrl,
  ]
    .filter(Boolean)
    .join(" ");
}

function hasAnyUrl(input: KnowledgePackPrecheckInput): boolean {
  return Boolean(
    input.productUrl?.trim() ||
      input.officialDocsUrl?.trim() ||
      input.apiDocsUrl?.trim() ||
      input.repositoryUrl?.trim()
  );
}

function licenseLooksOpen(input: KnowledgePackPrecheckInput): boolean {
  const h = (input.licenseHint ?? "").toLowerCase();
  return /\b(mit|apache|bsd|gpl|lgpl|open\s*source|오픈소스|무료\s*오픈)\b/i.test(h);
}

function categoryBaseRisk(cat: KnowledgePackCategory): KnowledgePackPrecheckRiskLevel {
  if (cat === "AUTH") return "HIGH";
  if (cat === "SECURITY") return "HIGH";
  if (cat === "API" || cat === "INTEGRATION") return "MEDIUM";
  if (cat === "GRID" || cat === "UI") return "LOW";
  if (cat === "DATA") return "MEDIUM";
  return "MEDIUM";
}

function pushIssue(
  issues: KnowledgePackPrecheckIssue[],
  type: KnowledgePackPrecheckIssueType,
  riskLevel: KnowledgePackPrecheckRiskLevel,
  title: string,
  description: string,
  recommendedAction: string
) {
  issues.push({ type, riskLevel, title, description, recommendedAction });
}

function maxRisk(a: KnowledgePackPrecheckRiskLevel, b: KnowledgePackPrecheckRiskLevel): KnowledgePackPrecheckRiskLevel {
  const order: KnowledgePackPrecheckRiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))]!;
}

function defaultLists(): Pick<
  KnowledgePackPrecheckResult,
  "requiredSources" | "recommendedSources" | "nextActions" | "reasons"
> {
  return {
    reasons: ["룰 기반 사전점검(v1) 결과입니다. LLM 보강은 후속 단계에서 연결할 수 있습니다."],
    requiredSources: ["제품 공식 문서(또는 신뢰할 수 있는 공개 문서) URL을 확보한다."],
    recommendedSources: ["API 명세·에러 코드·인증 방식이 있다면 API 문서 URL을 추가한다."],
    nextActions: ["사전점검 결과를 바탕으로 AI 초안을 생성한 뒤, 공식 문서와 대조 검증한다."],
  };
}

/**
 * LLM 없이 룰 기반으로 지식팩 등록 가능성을 점검한다.
 */
export async function precheckKnowledgePackRegistration(input: KnowledgePackPrecheckInput): Promise<KnowledgePackPrecheckResult> {
  const name = input.productName.trim();
  const diagnostics = ["precheck=rule_based_v1"];
  const issues: KnowledgePackPrecheckIssue[] = [];
  const lists = defaultLists();

  if (!name) {
    return {
      decision: "NOT_RECOMMENDED",
      riskLevel: "CRITICAL",
      score: 0,
      summary: "현재 정보만으로는 지식팩 등록을 권장하지 않습니다.",
      reasons: ["제품명이 비어 있습니다."],
      issues: [
        {
          type: "PUBLIC_SOURCE_INSUFFICIENT",
          riskLevel: "CRITICAL",
          title: "필수 식별 정보 없음",
          description: "제품명 없이는 지식팩 식별·검수 기준을 세울 수 없습니다.",
          recommendedAction: "제품명을 입력한 뒤 다시 사전점검을 실행하세요.",
        },
      ],
      requiredSources: lists.requiredSources,
      recommendedSources: lists.recommendedSources,
      nextActions: ["제품명을 입력하고 공개 URL 또는 문서 링크를 추가하세요."],
      canGenerateDraft: false,
      shouldRequireSecurityReview: true,
      shouldRequireLicenseReview: true,
      shouldRequireUserProvidedDocs: true,
      diagnostics,
    };
  }

  const text = combinedText(input);
  const urls = hasAnyUrl(input);
  let risk: KnowledgePackPrecheckRiskLevel = categoryBaseRisk(input.category);
  let score = 55;

  if (urls) score += 12;
  if (licenseLooksOpen(input)) score += 10;
  if (input.repositoryUrl?.trim()) score += 5;

  if (AUTH_KW.test(text)) {
    risk = maxRisk(risk, "HIGH");
    score -= 8;
    pushIssue(
      issues,
      "AUTH_SECRET_RISK",
      "HIGH",
      "인증·토큰·Secret 관련 키워드",
      "OAuth, Redirect URI, Client Secret 등 설정 오류 시 보안 사고로 이어질 수 있습니다.",
      "공식 인증 가이드·Redirect URI·토큰 수명 정책을 문서화하고 AI보안관 검토를 권장합니다."
    );
  }

  if (PAY_KW.test(text) || (input.category === "API" && /\b(결제|pg|금융)\b/i.test(text))) {
    risk = maxRisk(risk, "CRITICAL");
    score -= 18;
    pushIssue(
      issues,
      "PAYMENT_OR_FINANCE_RISK",
      "CRITICAL",
      "결제·금융 관련 키워드",
      "결제·금융 연동은 계약·심사·개인정보·금융보안 요건이 큽니다.",
      "테스트 키·샌드박스·약관·개인정보 처리방침을 확보하고 법무·보안 검토를 거치세요."
    );
  }

  if (PII_KW.test(text)) {
    risk = maxRisk(risk, "HIGH");
    score -= 6;
    pushIssue(
      issues,
      "PERSONAL_DATA_RISK",
      "HIGH",
      "개인정보 처리 키워드",
      "개인정보 수집·저장·전송은 법적 요건과 보안 통제가 필요합니다.",
      "최소 수집·목적 외 이용 금지·보관 기간을 명시하고 DPO/법무 검토를 권장합니다."
    );
  }

  if (LIC_KW.test(text)) {
    risk = maxRisk(risk, "MEDIUM");
    score -= 4;
    pushIssue(
      issues,
      "COMMERCIAL_LICENSE_RISK",
      "MEDIUM",
      "상용·엔터프라이즈·라이선스 검토",
      "상용 라이선스·벤더 계약은 사용 범위·배포·서브라이선스 조항을 확인해야 합니다.",
      "EULA·약관·견적서를 확보하고 라이선스 검토를 예약하세요."
    );
    pushIssue(
      issues,
      "TERMS_REVIEW_REQUIRED",
      "MEDIUM",
      "약관·이용조건 검토",
      "외부 서비스·상용 컴포넌트는 약관상 AI 학습·RAG 사용이 허용되는지 확인이 필요합니다.",
      "약관 PDF·FAQ를 원천자료로 등록하고 검수자에게 공유하세요."
    );
  }

  if (MAL_KW.test(text)) {
    risk = "CRITICAL";
    score = Math.min(score, 15);
    pushIssue(
      issues,
      "TERMS_REVIEW_REQUIRED",
      "CRITICAL",
      "비정상·위험 키워드 감지",
      "불법·회피·크랙 등 키워드가 감지되었습니다.",
      "합법적 범위 내 문서만 등록하고, 의도를 명확히 한 공식 자료로 대체하세요."
    );
  }

  if ((input.category === "API" || input.category === "INTEGRATION") && !input.apiDocsUrl?.trim()) {
    risk = maxRisk(risk, "MEDIUM");
    score -= 5;
    pushIssue(
      issues,
      "API_SPEC_MISSING",
      "MEDIUM",
      "API 명세 링크 권장",
      "외부 API·연동은 요청/응답 스키마·에러 코드·인증 방식이 필요합니다.",
      "OpenAPI/Swagger 또는 공식 API 레퍼런스 URL을 추가하세요."
    );
  }

  if (!urls && !licenseLooksOpen(input)) {
    risk = maxRisk(risk, "MEDIUM");
    score -= 10;
    pushIssue(
      issues,
      "OFFICIAL_DOCS_MISSING",
      "MEDIUM",
      "공개 URL·문서 부족",
      "제품명만으로는 공식 근거를 확보하기 어렵습니다.",
      "제품 URL, 공식 문서, 또는 저장소 링크를 추가하세요."
    );
  }

  if (!urls) {
    pushIssue(
      issues,
      "USER_DOCUMENT_REQUIRED",
      "MEDIUM",
      "사용자 제공 문서 필요 가능성",
      "비공개 제품이거나 로그인 후 문서만 제공되는 경우 공개 링크가 없을 수 있습니다.",
      "매뉴얼·API 명세 PDF를 원천자료(TEXT/MARKDOWN)로 업로드할 계획을 세우세요."
    );
  }

  if (input.category === "AUTH" || /\bkakao\b/i.test(text)) {
    pushIssue(
      issues,
      "AUTH_SECRET_RISK",
      "HIGH",
      "인증 연동(예: Redirect URI·토큰)",
      "Kakao Login 등 OAuth 연동은 Redirect URI 등록·Client Secret 관리가 핵심입니다.",
      "Kakao Developers 콘솔 설정과 공식 문서의 보안 가이드를 원천자료로 추가하세요."
    );
  }

  if (!urls) {
    pushIssue(issues, "RAG_NOT_READY", "LOW", "RAG 색인 준비", "원천 URL이 없으면 수집 기반 RAG를 바로 시작하기 어렵습니다.", "복제 후 원천 URL을 등록하고 수집·청크 파이프라인을 실행하세요.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let decision: KnowledgePackPrecheckResult["decision"] = "REGISTERABLE";
  let summary = "공식 문서 또는 공개 자료를 기반으로 지식팩 초안 생성이 가능합니다.";
  let canGenerateDraft = true;
  let shouldRequireSecurityReview = false;
  let shouldRequireLicenseReview = false;
  let shouldRequireUserProvidedDocs = false;

  if (MAL_KW.test(text) || score < 12) {
    decision = "NOT_RECOMMENDED";
    summary = "현재 정보만으로는 지식팩 등록을 권장하지 않습니다.";
    canGenerateDraft = false;
    shouldRequireSecurityReview = true;
    shouldRequireLicenseReview = true;
    shouldRequireUserProvidedDocs = true;
  } else if (!urls) {
    decision = "USER_SOURCE_REQUIRED";
    summary =
      "공개 자료만으로는 지식팩 품질을 보장하기 어렵습니다. 사용자가 매뉴얼/API 명세를 추가해야 합니다.";
    canGenerateDraft = true;
    shouldRequireUserProvidedDocs = true;
    shouldRequireLicenseReview = true;
  } else if (risk === "HIGH" || risk === "CRITICAL" || input.category === "AUTH" || issues.length >= 4) {
    decision = "LIMITED_REGISTERABLE";
    summary = "지식팩 초안 생성은 가능하지만, 라이선스·약관·보안 확인이 필요합니다.";
    shouldRequireSecurityReview = risk === "HIGH" || risk === "CRITICAL" || input.category === "AUTH";
    shouldRequireLicenseReview = true;
    canGenerateDraft = true;
  } else if (risk === "MEDIUM" || issues.length >= 2) {
    decision = "LIMITED_REGISTERABLE";
    summary = "지식팩 초안 생성은 가능하지만, 일부 항목에 대한 검토가 필요합니다.";
    shouldRequireLicenseReview = LIC_KW.test(text) || !licenseLooksOpen(input);
    shouldRequireSecurityReview = AUTH_KW.test(text);
    canGenerateDraft = true;
  }

  if (decision === "REGISTERABLE" && input.category === "AUTH") {
    decision = "LIMITED_REGISTERABLE";
    summary = "지식팩 초안 생성은 가능하지만, 라이선스·약관·보안 확인이 필요합니다.";
    shouldRequireSecurityReview = true;
    shouldRequireLicenseReview = true;
  }

  return {
    decision,
    riskLevel: risk,
    score,
    summary,
    reasons: lists.reasons,
    issues,
    requiredSources: lists.requiredSources,
    recommendedSources: [
      ...lists.recommendedSources,
      ...(input.officialDocsUrl?.trim() ? [] : ["공식 문서 URL을 입력하면 판정 품질이 좋아집니다."]),
    ],
    nextActions: [
      ...lists.nextActions,
      ...(decision === "USER_SOURCE_REQUIRED" ? ["내부 매뉴얼을 원천자료로 등록한 뒤 RAG 수집을 진행하세요."] : ["저장 전 AI검수자·AI보안관 관점에서 체크리스트를 확인하세요."]),
    ],
    canGenerateDraft,
    shouldRequireSecurityReview,
    shouldRequireLicenseReview,
    shouldRequireUserProvidedDocs,
    diagnostics,
  };
}
