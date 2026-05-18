/**
 * Harness Phase H1 — 내부 공유 string 헬퍼.
 *
 * builder / coerce / adapter 등 여러 모듈에서 동일 규칙으로 trim·clip을 수행하기 위한 단일 출처.
 */

/** value를 string으로 안전 변환 + trim. 비-string은 빈 문자열로. */
function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 문자열을 trim + 길이 제한. 초과 시 마지막 1글자를 "…"로 치환해 ellipsis 표기를 안정화한다.
 *
 * - max <= 0이면 빈 문자열.
 * - value가 falsy면 빈 문자열.
 */
export function trimAndClipString(value: unknown, max: number): string {
  if (max <= 0) return "";
  const s = toTrimmedString(value);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/** 음수·NaN·Infinity를 0으로, 그 외 finite는 floor한 비음수 정수로 정규화. */
export function coerceNonNegInt(value: unknown, fallback: number = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}
