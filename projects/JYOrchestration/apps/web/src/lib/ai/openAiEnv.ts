/**
 * 서버 전역 OpenAI 환경 변수 해석 — Chat Completions 호출부에서 중복 제거.
 */

/** `OPENAI_MODEL` 미설정 시 사용하는 기본 모델 ID */
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini" as const;

/** `OPENAI_MODEL`이 비어 있으면 `DEFAULT_OPENAI_MODEL` */
export function resolveOpenAiModelFromEnv(): string {
  const m = String(process.env.OPENAI_MODEL ?? "").trim();
  return m || DEFAULT_OPENAI_MODEL;
}

/** `OPENAI_API_KEY` trim — 없으면 빈 문자열 */
export function resolveOpenAiApiKeyFromEnv(): string {
  return String(process.env.OPENAI_API_KEY ?? "").trim();
}

export type ResolveOpenAiFromEnvOk = Readonly<{ ok: true; apiKey: string; model: string }>;
export type ResolveOpenAiFromEnvErr = Readonly<{ ok: false; message: string }>;

/** 프로토타입 검토 등 env 전용 경로용 — 키·모델을 한 번에 검증 */
export function resolveOpenAiFromEnv(): ResolveOpenAiFromEnvOk | ResolveOpenAiFromEnvErr {
  const apiKey = resolveOpenAiApiKeyFromEnv();
  if (!apiKey) {
    return { ok: false, message: "OPENAI_API_KEY가 서버에 설정되어 있지 않습니다." };
  }
  return { ok: true, apiKey, model: resolveOpenAiModelFromEnv() };
}
