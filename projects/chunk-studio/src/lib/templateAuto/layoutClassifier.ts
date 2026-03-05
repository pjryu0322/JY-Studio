import {
  MEETING_KEYWORDS,
  REPORT_KEYWORDS,
} from "./labelDictionary";

export type AutoDocType =
  | "form"
  | "weekly_report"
  | "monthly_report"
  | "meeting_minutes"
  | "unknown";

export function detectDocumentType(input: {
  text: string;
  tableCount: number;
  labelValuePairs: number;
  hasSignature: boolean;
  hasDateField: boolean;
}): AutoDocType {
  const text = input.text.toLowerCase();
  const meetingHits = MEETING_KEYWORDS.filter((k) => text.includes(k)).length;
  const reportHits = REPORT_KEYWORDS.filter((k) => text.includes(k)).length;
  const hasMonthly = /월간|monthly/.test(text);
  const hasWeekly = /주간|weekly|금주|차주/.test(text);
  const formScore =
    (input.tableCount >= 2 ? 1 : 0) +
    (input.labelValuePairs >= 3 ? 1 : 0) +
    (input.hasSignature ? 1 : 0) +
    (input.hasDateField ? 1 : 0);

  if (meetingHits >= 2) return "meeting_minutes";
  if (reportHits >= 2 && hasMonthly) return "monthly_report";
  if (reportHits >= 2 || hasWeekly) return "weekly_report";
  if (formScore >= 2) return "form";
  return "unknown";
}
