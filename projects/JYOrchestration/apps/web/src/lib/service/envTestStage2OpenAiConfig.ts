/**
 * ENV_TEST Stage 2: 모든 AI 멤버(Reviewer/Security/SCM/Executor ACK)가 동일한 경량 모델·낮은 temperature 로 OpenAI만 호출한다.
 * (일반 Task / Stage 1 OpenAI 평가와 분리)
 */

const DEFAULT_LIGHTWEIGHT = "gpt-4o-mini";

/** 환경변수로 덮어쓸 수 있음 — 전 역할 공통 */
export function resolveEnvTestStage2OpenAiModel(): string {
  const o = process.env.JYO_ENV_TEST_STAGE2_OPENAI_MODEL?.trim();
  return o || DEFAULT_LIGHTWEIGHT;
}

export const ENV_TEST_STAGE2_OPENAI_TEMPERATURE = 0.1 as const;
