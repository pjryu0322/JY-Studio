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
export const OVERLAY_CONTEXT_BUDGET_CHARS_PER_TOKEN = 4;

/** policy별 권장 입력 토큰 한계(휴리스틱). */
export const OVERLAY_CONTEXT_BUDGET_POLICY_BUDGETS: Readonly<Record<OverlayContextBudgetPolicy, number>> = {
  compact: 2_000,
  balanced: 6_000,
  default: 6_000,
  extended: 16_000,
};

/** policy 판별 임계값(prompt 길이·선택 컨텍스트 개수). */
const POLICY_THRESHOLDS = {
  compactMaxLength: 2_000,
  compactMaxContextCount: 6,
  extendedMinLength: 24_000,
  extendedMinContextCount: 20,
  balancedMinLength: 8_000,
  balancedMinContextCount: 12,
} as const;

/** overflowRisk 판정 비율(budget 대비). */
const OVERFLOW_RISK_RATIOS = { low: 0.6, medium: 0.9 } as const;

/** 응답 토큰 추정 휴리스틱. */
const OUTPUT_ESTIMATION = { ratio: 0.3, min: 256, max: 4_000 } as const;

function clampNonNegativeInt(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

function pickPolicy(promptLength: number, selectedContextCount: number): OverlayContextBudgetPolicy {
  if (
    promptLength <= POLICY_THRESHOLDS.compactMaxLength &&
    selectedContextCount <= POLICY_THRESHOLDS.compactMaxContextCount
  ) {
    return "compact";
  }
  if (
    promptLength >= POLICY_THRESHOLDS.extendedMinLength ||
    selectedContextCount >= POLICY_THRESHOLDS.extendedMinContextCount
  ) {
    return "extended";
  }
  if (
    promptLength >= POLICY_THRESHOLDS.balancedMinLength ||
    selectedContextCount >= POLICY_THRESHOLDS.balancedMinContextCount
  ) {
    return "balanced";
  }
  return "default";
}

function pickOverflowRisk(
  estimatedInput: number,
  policy: OverlayContextBudgetPolicy
): OverlayContextBudgetOverflowRisk {
  const budget = OVERLAY_CONTEXT_BUDGET_POLICY_BUDGETS[policy];
  if (estimatedInput <= budget * OVERFLOW_RISK_RATIOS.low) return "low";
  if (estimatedInput <= budget * OVERFLOW_RISK_RATIOS.medium) return "medium";
  return "high";
}

export function buildOverlayContextBudgetMetadata(input: {
  promptLength: number;
  selectedContextCount: number;
}): OverlayContextBudgetMetadata {
  const promptLength = clampNonNegativeInt(input.promptLength);
  const selectedContextCount = clampNonNegativeInt(input.selectedContextCount);
  const policy = pickPolicy(promptLength, selectedContextCount);
  const estimatedInputTokens = Math.ceil(promptLength / OVERLAY_CONTEXT_BUDGET_CHARS_PER_TOKEN);
  const estimatedOutputTokens = Math.min(
    OUTPUT_ESTIMATION.max,
    Math.max(OUTPUT_ESTIMATION.min, Math.ceil(estimatedInputTokens * OUTPUT_ESTIMATION.ratio))
  );
  return {
    estimatedInputTokens: estimatedInputTokens || null,
    estimatedOutputTokens: promptLength > 0 ? estimatedOutputTokens : null,
    budgetPolicy: policy,
    overflowRisk: pickOverflowRisk(estimatedInputTokens, policy),
  };
}

function coerceOptionalTokenCount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

export function parseOverlayContextBudgetMetadataFromUnknown(
  raw: unknown
): OverlayContextBudgetMetadata | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const policy = String(r.budgetPolicy ?? "").trim() as OverlayContextBudgetPolicy;
  const risk = String(r.overflowRisk ?? "").trim() as OverlayContextBudgetOverflowRisk;
  if (!VALID_POLICIES.has(policy) || !VALID_RISKS.has(risk)) return null;
  return {
    estimatedInputTokens: coerceOptionalTokenCount(r.estimatedInputTokens),
    estimatedOutputTokens: coerceOptionalTokenCount(r.estimatedOutputTokens),
    budgetPolicy: policy,
    overflowRisk: risk,
  };
}

export type OverlayContextBudgetSummaryWire = Readonly<{
  budgetPolicy: OverlayContextBudgetPolicy | null;
  overflowRisk: OverlayContextBudgetOverflowRisk | null;
  estimatedInputTokens: number | null;
  estimatedOutputTokens: number | null;
}>;

/** Diagnostic API용 budget summary(없으면 모든 필드 `null`). */
export function summarizeOverlayContextBudgetMetadata(
  metadata: OverlayContextBudgetMetadata | null | undefined
): OverlayContextBudgetSummaryWire {
  if (!metadata) {
    return {
      budgetPolicy: null,
      overflowRisk: null,
      estimatedInputTokens: null,
      estimatedOutputTokens: null,
    };
  }
  return {
    budgetPolicy: metadata.budgetPolicy,
    overflowRisk: metadata.overflowRisk,
    estimatedInputTokens: metadata.estimatedInputTokens,
    estimatedOutputTokens: metadata.estimatedOutputTokens,
  };
}
