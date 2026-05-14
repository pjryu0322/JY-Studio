/**
 * Overlay Observability UI — 사용자 표시용 **숫자 포맷** 유틸.
 *
 * 모든 함수는 **순수**하다. runtime payload·라우팅 어디에도 영향 없음.
 */

/** 결측치 표기. UI에서 "—" / "ㅡ" 등 시각 통일에 사용. */
export const OVERLAY_UI_MISSING_NUMBER = "—";

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
