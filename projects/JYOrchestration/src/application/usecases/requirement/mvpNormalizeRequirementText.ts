/**
 * Requirement Input — normalize raw user idea text (deterministic, no LLM).
 */

/** Trims, collapses whitespace, and strips common intent-noise suffixes (KO/EN). */
export function normalizeRequirementText(inputText: string): string {
  let t = String(inputText ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!t) return "";
  t = t
    .replace(/\s*(만들고\s*싶다|하고\s*싶다|하고\s*싶어요|해\s*주세요|해주세요|입니다\.?)\s*$/iu, "")
    .trim();
  t = t.replace(/\s*\.+\s*$/, "").trim();
  return t;
}
