import type { AuditLogEntry } from "./auditLog";

export interface ClassifierOverview {
  totalClassifiedPages: number;
  lowConfidencePages: number;
  confidenceDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  pageTypeBreakdown: Array<{
    key: string;
    count: number;
  }>;
  subTypeBreakdown: Array<{
    key: string;
    count: number;
  }>;
  overrideFrequency: {
    total: number;
    orientation: number;
    pageType: number;
    subType: number;
  };
}

export function buildClassifierOverview(
  logs: AuditLogEntry[],
): ClassifierOverview {
  let high = 0;
  let medium = 0;
  let low = 0;
  let lowConfidencePages = 0;
  let totalClassifiedPages = 0;
  let overrideOrientation = 0;
  let overridePageType = 0;
  let overrideSubType = 0;
  const pageTypeMap = new Map<string, number>();
  const subTypeMap = new Map<string, number>();

  for (const log of logs) {
    if (log.category === "page_classifier") {
      totalClassifiedPages += 1;
      const confidence = readNumber(log.detail?.confidence);
      if (confidence != null) {
        if (confidence > 0.85) high += 1;
        else if (confidence >= 0.6) medium += 1;
        else {
          low += 1;
          lowConfidencePages += 1;
        }
      }
      const pageType = readString(log.detail?.pageType);
      const subType = readString(log.detail?.subType);
      if (pageType) {
        pageTypeMap.set(
          pageType,
          (pageTypeMap.get(pageType) ?? 0) + 1,
        );
      }
      if (subType) {
        subTypeMap.set(
          subType,
          (subTypeMap.get(subType) ?? 0) + 1,
        );
      }
      continue;
    }

    if (log.category !== "workspace_edit") continue;
    if (log.action === "override_orientation") {
      overrideOrientation += 1;
    } else if (log.action === "override_page_type") {
      overridePageType += 1;
    } else if (log.action === "override_sub_type") {
      overrideSubType += 1;
    }
  }

  return {
    totalClassifiedPages,
    lowConfidencePages,
    confidenceDistribution: { high, medium, low },
    pageTypeBreakdown: toSortedItems(pageTypeMap),
    subTypeBreakdown: toSortedItems(subTypeMap),
    overrideFrequency: {
      total:
        overrideOrientation + overridePageType + overrideSubType,
      orientation: overrideOrientation,
      pageType: overridePageType,
      subType: overrideSubType,
    },
  };
}

function toSortedItems(source: Map<string, number>) {
  return Array.from(source.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value
    : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}
