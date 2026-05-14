/**
 * Overlay Observability UI — 사용자 표시용 **숫자 포맷** 유틸.
 *
 * 모든 함수는 **순수**하다. runtime payload·라우팅 어디에도 영향 없음.
 */

/** 결측치 표기. UI에서 "—" / "ㅡ" 등 시각 통일에 사용. */
export const OVERLAY_UI_MISSING_NUMBER = "—";

/** 결측치 표기(rate). 분모 0/NaN 등에서 사용. */
export const OVERLAY_UI_MISSING_RATE = "ㅡ";

/**
 * `number | null | undefined` 을 사용자 표시용 한국어 정수 문자열로 변환한다.
 *
 * - 유효하지 않은 값(`null`/`undefined`/`NaN`/`Infinity`)은 `OVERLAY_UI_MISSING_NUMBER`.
 * - 음수·소수점은 안전하게 잘라 0 이상 정수로 표시한다.
 * - locale은 `"ko-KR"` 고정.
 */
export function formatKoreanInt(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return OVERLAY_UI_MISSING_NUMBER;
  return Math.max(0, Math.floor(value)).toLocaleString("ko-KR");
}

/**
 * 0~1 비율(`0.247`)을 사용자 친화 백분율 문자열(`"25%"`)로 변환한다.
 *
 * - 유효하지 않은 값(`null`/`undefined`/`NaN`/`Infinity`/`< 0`)은 `OVERLAY_UI_MISSING_RATE`.
 * - 1을 초과하면 100%로 clamp.
 * - 기본 소수점 자리수는 0(`25%`). 필요 시 `fractionDigits`로 조정 가능(0~2).
 *
 * H2 Apply-readiness, H3+ 누적 진단 등 비율 라벨의 단일 출처.
 */
export function formatRateLabel(
  value: number | null | undefined,
  fractionDigits: 0 | 1 | 2 = 0,
  fallback: string = OVERLAY_UI_MISSING_RATE
): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  const clamped = Math.min(1, Math.max(0, value));
  return `${(clamped * 100).toFixed(fractionDigits)}%`;
}
