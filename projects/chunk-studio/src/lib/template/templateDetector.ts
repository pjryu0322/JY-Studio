export interface LayoutProfile {
  docType:
    | "weekly_report"
    | "monthly_report"
    | "meeting_minutes"
    | "form"
    | "unknown";
  anchorCandidates: Array<{
    text: string;
    type: "text" | "regex";
    confidence: number;
  }>;
  sectionCandidates: Array<{
    title: string;
    level: number;
    order: number;
    confidence: number;
  }>;
  tableCandidates: Array<{
    headerLabels: string[];
    confidence: number;
  }>;
  hasSignature: boolean;
}

function inferDocType(text: string): LayoutProfile["docType"] {
  const t = text.toLowerCase();
  if (/회의록|회의\s*안건|참석자|meeting\s*minutes/.test(t))
    return "meeting_minutes";
  if (/주간|weekly|이번\s*주/.test(t)) return "weekly_report";
  if (/월간|monthly|당월/.test(t)) return "monthly_report";
  if (/신청서|양식|성명|주소|연락처|form/.test(t)) return "form";
  return "unknown";
}

export function detectLayoutProfile(text: string): LayoutProfile {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const docType = inferDocType(text);

  const anchorCandidates = lines.slice(0, 10).map((line, idx) => ({
    text: line.slice(0, 80),
    type: "text" as const,
    confidence: Number((0.85 - idx * 0.05).toFixed(2)),
  }));

  const sectionCandidates = lines
    .map((line, idx) => ({ line, idx }))
    .filter(({ line }) =>
      /^(제?\s*\d+\s*(장|절|조)|\d+(\.\d+){0,3}|[가-힣A-Za-z ]{2,30}:?)$/.test(line)
    )
    .slice(0, 30)
    .map(({ line, idx }, order) => ({
      title: line.replace(/[:：]$/, ""),
      level: /^\d+\.\d+\.\d+/.test(line) ? 3 : /^\d+\.\d+/.test(line) ? 2 : 1,
      order: order + idx,
      confidence: 0.72,
    }));

  const tableCandidates = lines
    .filter((line) => line.includes("|"))
    .slice(0, 3)
    .map((line) => ({
      headerLabels: line
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, 8),
      confidence: 0.7,
    }));

  const hasSignature = /(서명|결재|승인|signature)/i.test(text);

  return {
    docType,
    anchorCandidates,
    sectionCandidates,
    tableCandidates,
    hasSignature,
  };
}

