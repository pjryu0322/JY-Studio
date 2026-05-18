/** 사용자 연동 등록 카드·검증 — Prisma 미의존(클라이언트에서 카드 정의만 import 가능). */

export type RegistrationProvider =
  | "OPENAI"
  | "ANTHROPIC"
  | "GOOGLE_AI"
  | "GEMINI"
  | "AZURE_OPENAI"
  | "LOCAL_LLM"
  | "CURSOR"
  | "GITHUB"
  | "VERCEL";

export type RegistrationCapability = "LLM" | "CODE_AGENT" | "SCM" | "DEPLOY";

export const INTEGRATION_REGISTRATION_CARDS = [
  {
    key: "openai_llm",
    provider: "OPENAI",
    capability: "LLM",
    title: "OpenAI · LLM",
    description:
      "Chat Completions 등 OpenAI API 키 (gpt-4o-mini 등). 프로토타입 작업계획·요구사항 OpenAI 연결 검사에 사용됩니다.",
    placeholder: "sk-… 키 붙여넣기",
    mvpConnected: true,
  },
  {
    key: "anthropic_llm",
    provider: "ANTHROPIC",
    capability: "LLM",
    title: "Anthropic (Claude) · LLM",
    description: "Claude API 키. 등록·기본값·override 선택은 지원하며, 앱 내 호출 경로는 추후 연결됩니다.",
    placeholder: "sk-ant-api03-… 키 붙여넣기",
    mvpConnected: false,
  },
  {
    key: "google_llm",
    provider: "GOOGLE_AI",
    capability: "LLM",
    title: "Google AI (Gemini) · LLM",
    description: "Google AI Studio / Gemini API 키. LLM 슬롯에 연결 시 resolve 경로에 포함됩니다(호출 어댑터는 추후).",
    placeholder: "AIza… 또는 API 키 붙여넣기",
    mvpConnected: false,
  },
  {
    key: "gemini_llm",
    provider: "GEMINI",
    capability: "LLM",
    title: "Gemini (별칭) · LLM",
    description: "Prisma enum `GEMINI`용 슬롯. Google AI 키와 동일 계열을 등록할 수 있으며 호출은 아직 미구현입니다.",
    placeholder: "API 키 붙여넣기",
    mvpConnected: false,
  },
  {
    key: "azure_openai_llm",
    provider: "AZURE_OPENAI",
    capability: "LLM",
    title: "Azure OpenAI · LLM",
    description: "Azure OpenAI 엔드포인트 키·연결 문자열. MVP에서는 등록만 지원합니다.",
    placeholder: "Azure API 키 또는 연결 문자열",
    mvpConnected: false,
  },
  {
    key: "local_llm",
    provider: "LOCAL_LLM",
    capability: "LLM",
    title: "Local LLM · LLM",
    description: "로컬/온프레 LLM 게이트웨이 토큰. MVP에서는 등록·해석만, 실제 라우팅은 추후입니다.",
    placeholder: "토큰 또는 API 키",
    mvpConnected: false,
  },
  {
    key: "cursor_agent",
    provider: "CURSOR",
    capability: "CODE_AGENT",
    title: "Cursor · CODE_AGENT",
    description:
      "Cursor Cloud Agent API 토큰. CODE_AGENT capability로 resolve되며 실행 설정보다 우선합니다.",
    placeholder: "Cursor API 토큰 붙여넣기",
    mvpConnected: true,
  },
  {
    key: "github_scm",
    provider: "GITHUB",
    capability: "SCM",
    title: "GitHub · SCM",
    description:
      "GitHub PAT(classic 또는 fine-grained). 저장소 접근·PR 등에 SCM capability로 resolve됩니다.",
    placeholder: "ghp_… 또는 github_pat_… 붙여넣기",
    mvpConnected: true,
  },
  {
    key: "github_deploy",
    provider: "GITHUB",
    capability: "DEPLOY",
    title: "GitHub · DEPLOY (Pages 등)",
    description: "GitHub 기반 배포용 PAT. SCM과 별도 행으로 등록할 수 있습니다(동일 키 가능).",
    placeholder: "ghp_… 또는 github_pat_… 붙여넣기",
    mvpConnected: true,
  },
  {
    key: "vercel_deploy",
    provider: "VERCEL",
    capability: "DEPLOY",
    title: "Vercel · DEPLOY",
    description: "Vercel 토큰. 해석기는 등록·선택 위주이며 호출 경로는 확장 예정입니다.",
    placeholder: "Vercel 토큰 붙여넣기",
    mvpConnected: false,
  },
] as const satisfies ReadonlyArray<{
  readonly key: string;
  readonly provider: RegistrationProvider;
  readonly capability: RegistrationCapability;
  readonly title: string;
  readonly description: string;
  readonly placeholder: string;
  readonly mvpConnected: boolean;
}>;

export type IntegrationRegistrationCardKey = (typeof INTEGRATION_REGISTRATION_CARDS)[number]["key"];

/** Settings → Integrations 화면 섹션 구성 */
export const INTEGRATION_UI_SECTIONS = [
  {
    id: "llm",
    title: "LLM",
    cardKeys: [
      "openai_llm",
      "anthropic_llm",
      "google_llm",
      "gemini_llm",
      "azure_openai_llm",
      "local_llm",
    ] as const satisfies readonly IntegrationRegistrationCardKey[],
  },
  {
    id: "code_agent",
    title: "Code Agent",
    cardKeys: ["cursor_agent"] as const satisfies readonly IntegrationRegistrationCardKey[],
  },
  {
    id: "git_deploy",
    title: "Git / Deploy",
    cardKeys: ["github_scm", "github_deploy", "vercel_deploy"] as const satisfies readonly IntegrationRegistrationCardKey[],
  },
] as const;

const PROVIDERS = new Set<string>(INTEGRATION_REGISTRATION_CARDS.map((c) => c.provider));
const CAPABILITIES = new Set<string>(INTEGRATION_REGISTRATION_CARDS.map((c) => c.capability));

export function parseIntegrationProvider(raw: unknown): RegistrationProvider | null {
  const s = String(raw ?? "").trim().toUpperCase();
  return PROVIDERS.has(s) ? (s as RegistrationProvider) : null;
}

export function parseIntegrationCapability(raw: unknown): RegistrationCapability | null {
  const s = String(raw ?? "").trim().toUpperCase();
  return CAPABILITIES.has(s) ? (s as RegistrationCapability) : null;
}

export function validateUserIntegrationSecret(
  provider: RegistrationProvider,
  capability: RegistrationCapability,
  secret: string
): string | null {
  const t = secret.trim();
  if (!t) return "secret이 비어 있습니다.";

  const allowed = new Set(INTEGRATION_REGISTRATION_CARDS.map((c) => `${c.provider}|${c.capability}`));
  if (!allowed.has(`${provider}|${capability}`)) {
    return "지원하지 않는 provider·capability 조합입니다.";
  }

  if (capability === "LLM") {
    if (provider === "OPENAI" && !t.startsWith("sk-")) return "OpenAI 키는 sk- 로 시작해야 합니다.";
    if (provider === "ANTHROPIC" && !t.startsWith("sk-ant")) return "Anthropic 키는 sk-ant 로 시작하는 형식이어야 합니다.";
    if (provider === "GOOGLE_AI" && t.length < 16) return "Google AI 키가 너무 짧습니다.";
    if (provider === "GEMINI" && t.length < 16) return "Gemini API 키가 너무 짧습니다.";
    if (provider === "AZURE_OPENAI" && t.length < 16) return "Azure OpenAI 자격 정보가 너무 짧습니다.";
    if (provider === "LOCAL_LLM" && t.length < 8) return "Local LLM 토큰/키를 확인해 주세요.";
    return null;
  }

  if (provider === "CURSOR" && capability === "CODE_AGENT") {
    if (t.length < 8) return "Cursor 토큰을 확인해 주세요.";
    return null;
  }

  if (provider === "GITHUB" && (capability === "SCM" || capability === "DEPLOY")) {
    const ok =
      t.startsWith("ghp_") ||
      t.startsWith("github_pat_") ||
      t.startsWith("gho_") ||
      t.startsWith("ghu_") ||
      t.length >= 32;
    if (!ok) return "GitHub PAT 형식(ghp_…, github_pat_…) 또는 충분한 길이의 토큰을 입력하세요.";
    return null;
  }

  if (provider === "VERCEL" && capability === "DEPLOY") {
    if (t.length < 10) return "Vercel 토큰을 확인해 주세요.";
    return null;
  }

  return null;
}
