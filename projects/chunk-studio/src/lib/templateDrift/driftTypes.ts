import type { TemplateSchema } from "@/lib/template/schema";

export type DriftSeverity = "low" | "medium" | "high";

export type DriftKind =
  | "SECTION_ADDED"
  | "SECTION_REMOVED"
  | "SECTION_RENAMED"
  | "FIELD_ADDED"
  | "FIELD_REMOVED"
  | "FIELD_RELABELED"
  | "TABLE_ADDED"
  | "TABLE_REMOVED"
  | "TABLE_HEADER_CHANGED"
  | "REPEAT_ADDED"
  | "REPEAT_REMOVED"
  | "REPEAT_PATTERN_CHANGED"
  | "ANCHOR_MISSING"
  | "ANCHOR_CHANGED"
  | "LAYOUT_SHIFT";

export interface DriftRef {
  sectionId?: string;
  fieldKey?: string;
  tableId?: string;
  repeatId?: string;
  anchorValue?: string;
}

export type DriftMetrics = Record<string, string | number | boolean | null>;

export interface DriftItem {
  kind: DriftKind;
  severity: DriftSeverity;
  message: string;
  reason?: string;
  recommendedAction?: string;
  ref?: DriftRef;
  metrics?: DriftMetrics;
}

export interface DriftSummary {
  added: number;
  removed: number;
  modified: number;
  anchorsMissing: number;
  layoutShifts: number;
}

export interface DriftResult {
  templateId: string;
  version: string;
  docId: string;
  docType: TemplateSchema["docType"];
  severity: DriftSeverity;
  score: number;
  items: DriftItem[];
  summary: DriftSummary;
}
