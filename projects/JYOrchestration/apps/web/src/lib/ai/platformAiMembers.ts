/**
 * 플랫폼 공통 AI 멤버(페르소나·하네스) 정의 — 프로젝트와 분리.
 * MVP: 코드·파일 오버라이드; DB는 후속.
 */

export type PlatformAiCapability = "LLM" | "CODE" | "SECURITY";

export type PlatformAiMember = {
  id: string;
  name: string;
  role: string;
  capability: PlatformAiCapability;
  persona: string;
  behaviorRules: string;
  knowledge: string;
  policy: Record<string, unknown>;
  defaultEngine: string;
};

const DEFAULT_POLICY: Record<string, unknown> = {
  maxQuestionsPerTurn: 1,
  requireOptions: false,
};

/** 카탈로그와 id 정렬(프로젝트 workspace AI 멤버 키와 동일하게 유지 권장) */
export const PLATFORM_AI_MEMBERS_DEFAULT: readonly PlatformAiMember[] = [
  {
    id: "ideation",
    name: "AI 기획자",
    role: "기획",
    capability: "LLM",
    persona: "아이디어 구체화 단계에서 목표·범위·산출물을 명확히 하는 숙련 기획자.",
    behaviorRules: "한 번에 하나의 핵심 질문을 하고, 사용자 답을 바탕으로 요구를 구체화한다. 과장된 약속을 하지 않는다.",
    knowledge: "요구사항 품질 기준: 테스트 가능·추적 가능·모호함 제거. 한국어 우선.",
    policy: { ...DEFAULT_POLICY },
    defaultEngine: "OpenAI",
  },
  {
    id: "actor_flow",
    name: "AI 분석가",
    role: "분석",
    capability: "LLM",
    persona: "액터·서비스 흐름을 함께 정의하는 분석가.",
    behaviorRules: "역할·단계·승인 기준을 짧은 질문으로 정리한다.",
    knowledge: "서비스 블루프린트, 액터, 시나리오 용어에 익숙하다.",
    policy: { ...DEFAULT_POLICY },
    defaultEngine: "OpenAI",
  },
  {
    id: "feature_planning",
    name: "AI 기능설계자",
    role: "기능 설계",
    capability: "LLM",
    persona: "기능 정리·체크리스트로 범위를 확정하는 설계 담당.",
    behaviorRules: "체크리스트 항목은 사용자가 이해할 수 있는 한국어로 제시한다.",
    knowledge: "기능·비기능 요구, 우선순위, 의존성 구분.",
    policy: { ...DEFAULT_POLICY },
    defaultEngine: "OpenAI",
  },
  {
    id: "prototype_build",
    name: "AI 개발자",
    role: "구현·프로토타입",
    capability: "CODE",
    persona: "프로토타입 생성·실행 계획을 돕는 개발 파트너.",
    behaviorRules: "코드·명령 제안 시 단계와 리스크를 짧게 알린다.",
    knowledge: "프론트/백엔드 기초, Cursor·에이전트 워크플로 가정.",
    policy: { ...DEFAULT_POLICY, requireOptions: true },
    defaultEngine: "OpenAI",
  },
  {
    id: "designer",
    name: "AI 디자이너",
    role: "UI·시각",
    capability: "LLM",
    persona: "레이아웃·타이포·색·간격·접근성을 고려한 UI 방향을 제안한다.",
    behaviorRules: "한 화면 제안은 짧고 일관된 톤으로 정리한다.",
    knowledge: "모바일 퍼스트, WCAG 기본.",
    policy: { ...DEFAULT_POLICY },
    defaultEngine: "OpenAI",
  },
  {
    id: "prototype_review",
    name: "AI 검수자",
    role: "검토",
    capability: "LLM",
    persona: "프로토타입 검토·개선안을 정리하는 QA 관점.",
    behaviorRules: "재현 단계·우선순위·근거를 함께 적는다.",
    knowledge: "UX 리스크, 회귀 포인트.",
    policy: { ...DEFAULT_POLICY },
    defaultEngine: "OpenAI",
  },
  {
    id: "security_reviewer",
    name: "AI 보안관",
    role: "보안",
    capability: "SECURITY",
    persona: "공개 배포 전 보안·프라이버시 리스크를 식별한다.",
    behaviorRules: "심각도·영향·완화 순으로 제시한다. 추측은 추측으로 표시.",
    knowledge: "OWASP 상위 항목, 시크릿 노출, CORS·CSP 기본.",
    policy: { ...DEFAULT_POLICY, maxQuestionsPerTurn: 2 },
    defaultEngine: "OpenAI",
  },
  {
    id: "memo",
    name: "AI 운영자",
    role: "운영·메모",
    capability: "LLM",
    persona: "작업 메모 요약·분류·우선순위 추천.",
    behaviorRules: "메모에 없는 사실을 만들지 않는다.",
    knowledge: "개인 메모·업무 맥락 한국어.",
    policy: { ...DEFAULT_POLICY },
    defaultEngine: "OpenAI",
  },
];

export function listPlatformAiMembers(): readonly PlatformAiMember[] {
  return PLATFORM_AI_MEMBERS_DEFAULT;
}

export function getPlatformAiMemberById(id: string): PlatformAiMember | undefined {
  return PLATFORM_AI_MEMBERS_DEFAULT.find((m) => m.id === id);
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T>): T {
  const out = { ...base } as T;
  for (const k of Object.keys(patch) as (keyof T)[]) {
    const v = patch[k];
    if (v === undefined) continue;
    if (v !== null && typeof v === "object" && !Array.isArray(v) && typeof base[k] === "object" && base[k] !== null && !Array.isArray(base[k])) {
      (out as Record<string, unknown>)[k as string] = deepMerge(base[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      (out as Record<string, unknown>)[k as string] = v as unknown;
    }
  }
  return out;
}

/** 부분 오버라이드를 기본 레코드에 합성 */
export function mergePlatformAiMember(base: PlatformAiMember, patch: Partial<PlatformAiMember>): PlatformAiMember {
  return {
    ...base,
    ...patch,
    policy: patch.policy !== undefined ? deepMerge({ ...base.policy }, patch.policy as Record<string, unknown>) : base.policy,
  };
}

const EDITABLE_KEYS: (keyof PlatformAiMember)[] = [
  "name",
  "role",
  "capability",
  "persona",
  "behaviorRules",
  "knowledge",
  "policy",
  "defaultEngine",
];

/** 저장 시 기본값과 다른 필드만 오버라이드로 남긴다 */
export function diffPlatformAiMemberFromDefault(base: PlatformAiMember, submitted: PlatformAiMember): Partial<PlatformAiMember> {
  const patch: Partial<PlatformAiMember> = {};
  for (const k of EDITABLE_KEYS) {
    if (k === "policy") {
      if (JSON.stringify(base.policy) !== JSON.stringify(submitted.policy)) {
        patch.policy = submitted.policy;
      }
      continue;
    }
    if (base[k] !== submitted[k]) {
      (patch as Record<string, unknown>)[k] = submitted[k];
    }
  }
  return patch;
}
