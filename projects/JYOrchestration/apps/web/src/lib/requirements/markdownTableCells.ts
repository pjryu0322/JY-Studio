import type { FastPlanAssumption } from "@/lib/requirements/fastPlanGenerationTypes";

/** One-line cell text safe for GFM pipe tables (no raw newlines or unescaped pipes). */
export function sanitizeMarkdownTableCell(raw: string, maxLength?: number): string {
  let s = String(raw ?? "").trim();
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/\n+/g, " ").replace(/\s+/g, " ");
  s = s.replace(/\|/g, "\\|");
  if (maxLength != null && maxLength > 0) {
    s = s.slice(0, maxLength);
  }
  return s;
}

function fastPlanConfidenceKo(confidence: string): string {
  if (confidence === "confirmed") return "확정";
  if (confidence === "partial") return "부분";
  if (confidence === "candidate") return "후보";
  return "프로토타입용 가정";
}

function formatFastPlanAssumptionTableRow(assumption: FastPlanAssumption): string {
  return [
    "|",
    sanitizeMarkdownTableCell(assumption.label),
    "|",
    sanitizeMarkdownTableCell(assumption.value, 120),
    "|",
    fastPlanConfidenceKo(assumption.confidence),
    "|",
    sanitizeMarkdownTableCell(assumption.reason),
    "|",
  ].join(" ");
}

/** Header, separator, and data rows; empty string when there are no assumptions. */
export function buildFastPlanAssumptionMarkdownTable(
  assumptions: readonly FastPlanAssumption[],
): string {
  const rows = assumptions.map(formatFastPlanAssumptionTableRow).join("\n");
  if (!rows) return "";
  return ["| 항목 | 보완 내용 | 신뢰도 | 근거 |", "|---|---|---|---|", rows].join("\n");
}
