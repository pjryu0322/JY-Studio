/**
 * Short, user-facing menu labels (deterministic).
 */

const TAIL_NOISE =
  /\s*(기능|관리\s*기능|화면|화면\s*기능|서비스)\s*$/gu;
const DOUBLE_SPACE = /\s{2,}/g;

/**
 * Strips redundant implementation-ish suffixes; keeps Korean when input is Korean.
 */
export function normalizeMenuName(name: string): string {
  let t = String(name ?? "").replace(DOUBLE_SPACE, " ").trim();
  if (!t) return "";
  let prev = "";
  while (prev !== t) {
    prev = t;
    t = t.replace(TAIL_NOISE, "").trim();
  }
  if (t.length > 40) {
    t = t.slice(0, 40).trim();
  }
  return t;
}
