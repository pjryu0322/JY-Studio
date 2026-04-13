/**
 * Short, domain-oriented display names for menu / feature labels (deterministic).
 */

const TRAILING_NOISE =
  /\s*(기능이\s*필요하다|기능이\s*필요합니다|이\s*필요하다|이\s*필요합니다|만들고\s*싶다|해\s*주세요|해주세요)\s*$/iu;
const SUFFIX_FUNCTION = /\s*기능\s*$/u;

/**
 * Strips boilerplate, collapses whitespace, trims implementation-ish tails.
 * Preserves Korean when the input is Korean.
 */
export function normalizeFeatureName(name: string): string {
  let t = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  t = t.replace(TRAILING_NOISE, "").trim();
  t = t.replace(SUFFIX_FUNCTION, "").trim();
  t = t.replace(/\s+조회\s+조회/gu, " 조회");
  if (t.length > 48) {
    t = t.slice(0, 48).trim();
  }
  return t;
}
