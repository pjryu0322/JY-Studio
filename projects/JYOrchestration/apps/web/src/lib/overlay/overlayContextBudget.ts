/**
 * Overlay: heuristic-only token budget metadata.
 *
 * **이 헬퍼는 OpenAI payload·프롬프트 본문·라우팅을 변경하지 않는다.** 길이·선택 개수
 * 기반의 budget hint만 만든다. 실제 토큰 측정이 아니다.
 */

export type OverlayContextBudgetPolicy = "default" | "compact" | "balanced" | "extended";
export type OverlayContextBudgetOverflowRisk = "low" | "medium" | "high";

export type OverlayContextBudgetMetadata = Readonly<{
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
  budgetPolicy: OverlayContextBudgetPolicy;
  overflowRisk: OverlayContextBudgetOverflowRisk;
}>;

const VALID_POLICIES = new Set<OverlayContextBudgetPolicy>([
  "default",
  "compact",
  "balanced",
  "extended",
]);
const VALID_RISKS = new Set<OverlayContextBudgetOverflowRisk>(["low", "medium", "high"]);

/** 4 chars ≈ 1 token (OpenAI 공통 휴리스틱). */
const CHARS_PER_TOKEN = 4;

/** policy별 권장 입력 토큰 한계(휴리스틱). */
const POLICY_BUDGETS: Record<OverlayContextBudgetPolicy, number> = {
  compact: 2_000,
  balanced: 6_000,
  default: 6_000,
  extended: 16_000,
};

function pickPolicy(promptLength: number, selectedContextCount: number): OverlayContextBudgetPolicy {
  if (promptLength <= 2_000 && selectedContextCount <= 6) return "compact";
  if (promptLength >= 24_000 || selectedContextCount >= 20) return "extended";
  if (promptLength >= 8_000 || selectedContextCount >= 12) return "balanced";
  return "default";
}

function pickOverflowRisk(
  estimatedInput: number,
  policy: OverlayContextBudgetPolicy
): OverlayContextBudgetOverflowRisk {
  const budget = POLICY_BUDGETS[policy];
  if (estimatedInput <= budget * 0.6) return "low";
  if (estimatedInput <= budget * 0.9) return "medium";
  return "high";
}

export function buildOverlayContextBudgetMetadata(input: {
  promptLength: number;
  selectedContextCount: number;
}): OverlayContextBudgetMetadata {
  const promptLength = Number.isFinite(input.promptLength) ? Math.max(0, Math.floor(input.promptLength)) : 0;
  const selectedContextCount = Number.isFinite(input.selectedContextCount)
    ? Math.max(0, Math.floor(input.selectedContextCount))
    : 0;
  const policy = pickPolicy(promptLength, selectedContextCount);
  const estimatedInputTokens = Math.ceil(promptLength / CHARS_PER_TOKEN);
  // 응답 길이는 측정 불가 — heuristic으로 입력 대비 30% 추정(상한 4_000).
  const estimatedOutputTokens = Math.min(4_000, Math.max(256, Math.ceil(estimatedInputTokens * 0.3)));
  const overflowRisk = pickOverflowRisk(estimatedInputTokens, policy);
  return {
    estimatedInputTokens: estimatedInputTokens || null,
    estimatedOutputTokens: promptLength > 0 ? estimatedOutputTokens : null,
    budgetPolicy: policy,
    overflowRisk,
  };
}

export function parseOverlayContextBudgetMetadataFromUnknown(
  raw: unknown
): OverlayContextBudgetMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const policy = String(r.budgetPolicy ?? "").trim() as OverlayContextBudgetPolicy;
  const risk = String(r.overflowRisk ?? "").trim() as OverlayContextBudgetOverflowRisk;
  if (!VALID_POLICIES.has(policy) || !VALID_RISKS.has(risk)) return null;
  const input = r.estimatedInputTokens;
  const output = r.estimatedOutputTokens;
  const ein = input === null ? null : Number.isFinite(Number(input)) ? Math.max(0, Math.floor(Number(input))) : null;
  const eout = output === null ? null : Number.isFinite(Number(output)) ? Math.max(0, Math.floor(Number(output))) : null;
  return {
    estimatedInputTokens: ein,
    estimatedOutputTokens: eout,
    budgetPolicy: policy,
    overflowRisk: risk,
  };
}
