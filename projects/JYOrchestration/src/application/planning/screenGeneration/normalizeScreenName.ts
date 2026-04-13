/**
 * Stable, task-friendly screen titles (deterministic).
 */

const TAIL = /\s*(화면|스크린|screen)\s*$/iu;
const DUP_SUFFIX = /\s*(기능|화면)\s*(기능|화면)\s*$/u;

export type NormalizeScreenNameContext = {
  /** Reserved for future parent/child naming hints. */
  parentMenuName?: string;
};

/**
 * Collapses whitespace and strips redundant “screen/function” tails.
 */
export function normalizeScreenName(name: string, _context?: NormalizeScreenNameContext): string {
  let t = String(name ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  t = t.replace(DUP_SUFFIX, "").trim();
  t = t.replace(TAIL, "").trim();
  if (t.length > 56) {
    t = t.slice(0, 56).trim();
  }
  return t;
}
