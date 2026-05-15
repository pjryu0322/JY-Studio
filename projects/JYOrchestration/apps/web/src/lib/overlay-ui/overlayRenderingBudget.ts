/**
 * H8.5 — Overlay **렌더링 상한**(과밀 완화).
 */

export const OVERLAY_MAX_VISIBLE_ADVANCED_SECTIONS = 3;
export const OVERLAY_MAX_VISIBLE_WARNING_GROUPS = 5;
export const OVERLAY_MAX_VISIBLE_FINDINGS = 8;

export function clipWithHiddenCount<T>(items: readonly T[], max: number): Readonly<{ visible: readonly T[]; hiddenCount: number }> {
  if (items.length <= max) return { visible: items, hiddenCount: 0 };
  return { visible: items.slice(0, max), hiddenCount: items.length - max };
}
