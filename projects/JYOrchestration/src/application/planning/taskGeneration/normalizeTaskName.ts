/**
 * Action-oriented task titles for mockup generation (deterministic).
 */

/**
 * Korean/English screen label → “… 화면 생성” style task title.
 * Empty input gets a safe default.
 */
export function normalizeTaskName(screenName: string): string {
  const raw = String(screenName ?? "").replace(/\s+/g, " ").trim();
  if (!raw) {
    return "미지정 화면 생성";
  }
  if (/(화면\s*)?생성\s*$/u.test(raw)) {
    return raw;
  }
  return `${raw} 화면 생성`;
}
