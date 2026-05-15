/**
 * H9.5 — Explainability 등 **표시 노이즈 완화**(read-only, payload 변경 없음).
 */

import { RESOURCE_STABILIZATION_MAX_EXPLAINABILITY_SUMMARY_LINES } from "./resourceStabilizationPolicy";

/** 인접·공백만 다른 중복 요약 줄을 한 줄로 합친다. */
export function dedupeExplainabilitySummaryLines(lines: readonly string[]): string[] {
  const out: string[] = [];
  let prevNorm: string | null = null;
  for (const raw of lines) {
    const line = String(raw ?? "").trim();
    if (!line) continue;
    const norm = line.replace(/\s+/g, " ");
    if (norm === prevNorm) continue;
    prevNorm = norm;
    out.push(line);
  }
  return out;
}

export function clipExplainabilitySummaryLinesForDisplay(
  lines: readonly string[],
  max: number = RESOURCE_STABILIZATION_MAX_EXPLAINABILITY_SUMMARY_LINES
): Readonly<{ visible: readonly string[]; hiddenLineCount: number }> {
  const deduped = dedupeExplainabilitySummaryLines(lines);
  if (deduped.length <= max) return { visible: deduped, hiddenLineCount: 0 };
  return { visible: deduped.slice(0, max), hiddenLineCount: deduped.length - max };
}
