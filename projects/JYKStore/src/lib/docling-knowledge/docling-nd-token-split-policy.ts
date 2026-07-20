/**
 * Title clamp + token budget for multi-part split suffixes.
 * Does not change token-counting algorithms.
 */
import { fixLoneSurrogates, sliceUtf16Safe } from "@/lib/text-encoding-safe";

export const MAX_UNIT_CHARS = 6000;
export const MIN_CHUNK_CHARS = 40;
export const MAX_RESPLIT_DEPTH = 2;

export function clampTitle(text: string, max: number): string {
  const t = fixLoneSurrogates(text.replace(/\s+/g, " ").trim());
  if (t.length <= max) return t;
  return `${sliceUtf16Safe(t, max - 1).trimEnd()}…`;
}

/** Budget title with worst-case multi-part suffix reserved (e.g. " (9999)"). */
export function reserveSplitSuffixTokens(
  title: string,
  options?: { maxDigits?: number },
): string {
  const digits = Math.max(1, options?.maxDigits ?? 4);
  const suffix = ` (${"9".repeat(digits)})`;
  return clampTitle(`${title}${suffix}`, 120);
}
