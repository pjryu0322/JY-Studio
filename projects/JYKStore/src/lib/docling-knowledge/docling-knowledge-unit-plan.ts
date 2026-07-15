/**
 * Pure planning helpers for Docling knowledge-unit body coverage & short-section merges.
 * No DB / Prisma imports — unit-testable.
 */

export const DOCLING_KU_MIN_CHARS = 40;

export const DOCLING_KU_PASS_THRESHOLDS = {
  eligibleBodyCoveragePass: 0.99,
  eligibleBodyCoverageWarn: 0.95,
  tableCoveragePass: 0.99,
  tableCoverageWarn: 0.95,
} as const;

export type ExclusionReasonDetail = {
  count: number;
  charCount: number;
  sampleTexts: string[];
};

export type ExclusionReasonMap = Record<string, ExclusionReasonDetail>;

export type PlannedBodyUnit = {
  title: string;
  text: string;
  path: string[];
  pathLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  sourceSectionIds: string[];
  sourceTextRanges: Array<{ sectionId: string; start: number; end: number }>;
  mergeReason: string | null;
  unitType: string;
  startOffset: number;
  endOffset: number;
  shortValidUnit: boolean;
};

export type BodyPlanMetrics = {
  rawBodyChars: number;
  eligibleBodyChars: number;
  unitBodyChars: number;
  normalExcludedBodyChars: number;
  criticalExcludedBodyChars: number;
  rawBodyCoverage: number;
  eligibleBodyCoverage: number;
  shortSectionMergedCount: number;
  shortValidUnitCount: number;
  exclusionReasons: ExclusionReasonMap;
};

export type NdSectionLike = {
  id?: string;
  title?: string | null;
  text?: string | null;
  label?: string | null;
  page?: number | null;
  children?: NdSectionLike[];
};

type FlatSection = {
  id: string;
  title: string;
  text: string;
  label: string;
  page: number | null;
  path: string[];
  pathLabel: string;
  childTexts: string[];
  uniqueText: string;
};

const SAMPLE_MAX = 3;
const SAMPLE_LEN = 120;

const PAGE_NUMBER_RE = /^\d{1,4}$/;
const DECORATIVE_RE = /^[\s·•・\-–—_=*★☆◇◆□■○●◎※]+$/;
const ERROR_CODE_RE =
  /^(ERR|ERROR|E|WARN|WARNING|W|CODE)[-_\s]?\d{2,}|^[A-Z]{2,5}-\d{2,}|\b오류\s*코드\b/i;
const CONFIG_VALUE_RE =
  /[=:：]\s*[^\s]{1,40}$|^(true|false|on|off|enabled|disabled)\b|\.(json|yaml|yml|xml|env)\b|[A-Z][A-Z0-9_]{2,}=/i;
const MONEY_UNIT_RE =
  /\d+\s*(원|₩|\$|USD|KRW|%|퍼센트|명|건|회|개|분|초|ms|MB|GB|KB)|요율|단가|금액/i;
const API_FIELD_RE =
  /^[a-z][a-zA-Z0-9_.]{1,48}$|^[A-Z][a-zA-Z0-9]+(\.[a-zA-Z0-9_]+)+$|^(GET|POST|PUT|PATCH|DELETE)\s+\//;
const WARNING_KW_RE = /^(주의|경고|참고|Note|Warning|Caution|중요|금지)[:：\s]/i;

const FURNITURE_LABELS = new Set([
  "page_header",
  "page_footer",
  "furniture",
  "page_number",
]);

function sampleText(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= SAMPLE_LEN) return t;
  return `${t.slice(0, SAMPLE_LEN - 1)}…`;
}

export function bumpExclusionReason(
  map: ExclusionReasonMap,
  reason: string,
  text: string,
  charCount = text.length,
): void {
  const cur = map[reason] ?? { count: 0, charCount: 0, sampleTexts: [] };
  cur.count += 1;
  cur.charCount += Math.max(0, charCount);
  if (cur.sampleTexts.length < SAMPLE_MAX && text.trim()) {
    cur.sampleTexts.push(sampleText(text));
  }
  map[reason] = cur;
}

function normalizeForDup(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function collectChildTexts(children: NdSectionLike[]): string[] {
  const out: string[] = [];
  for (const c of children) {
    const t = (c.text ?? "").trim();
    if (t) out.push(t);
    if (Array.isArray(c.children) && c.children.length > 0) {
      out.push(...collectChildTexts(c.children));
    }
  }
  return out;
}

/** Parent text unique contribution after removing child spans. */
export function uniqueParentText(parentText: string, childTexts: string[]): string {
  let unique = parentText;
  const sorted = [...childTexts].filter((c) => c.length > 0).sort((a, b) => b.length - a.length);
  for (const c of sorted) {
    if (c.length >= 8 && unique.includes(c)) {
      unique = unique.split(c).join(" ");
    }
  }
  return unique.replace(/\s+/g, " ").trim();
}

function flattenSections(sections: NdSectionLike[]): FlatSection[] {
  const result: FlatSection[] = [];
  const walk = (secs: NdSectionLike[], path: string[]) => {
    for (const section of secs) {
      const text = (section.text ?? "").trim();
      const title =
        (section.title ?? "").trim() ||
        text.slice(0, 40) ||
        path[path.length - 1] ||
        "섹션";
      const nextPath = [...path, title];
      const children = Array.isArray(section.children) ? section.children : [];
      const childTexts = collectChildTexts(children);
      const uniqueText =
        childTexts.length > 0 ? uniqueParentText(text, childTexts) : text;
      result.push({
        id: section.id?.trim() || `anon-${result.length}`,
        title,
        text,
        label: (section.label ?? "").toLowerCase().trim(),
        page: typeof section.page === "number" ? section.page : null,
        path: nextPath,
        pathLabel: nextPath.join(" > "),
        childTexts,
        uniqueText,
      });
      if (children.length > 0) walk(children, nextPath);
    }
  };
  walk(sections, []);
  return result;
}

function isFurnitureLabel(label: string): boolean {
  return (
    FURNITURE_LABELS.has(label) ||
    label.includes("page_header") ||
    label.includes("page_footer")
  );
}

export function isPageNumberText(text: string, label = ""): boolean {
  if (label === "page_number") return true;
  return PAGE_NUMBER_RE.test(text.trim());
}

export function isDecorativeText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return DECORATIVE_RE.test(t);
}

export function isStandAloneShortUnitEligible(text: string, label: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    label.includes("list_item") ||
    label.includes("list") ||
    label.includes("section_header") ||
    label === "title" ||
    label.includes("heading") ||
    label.includes("code") ||
    label.includes("formula") ||
    label.includes("caption")
  ) {
    return true;
  }
  if (WARNING_KW_RE.test(t)) return true;
  if (ERROR_CODE_RE.test(t)) return true;
  if (CONFIG_VALUE_RE.test(t)) return true;
  if (MONEY_UNIT_RE.test(t)) return true;
  if (API_FIELD_RE.test(t)) return true;
  return false;
}

function inferMergeReason(items: FlatSection[]): string {
  const labels = items.map((i) => i.label);
  if (labels.every((l) => l.includes("list"))) return "short_list_merged";
  if (items.some((i) => WARNING_KW_RE.test(i.text))) return "short_warning_merged";
  if (items.some((i) => ERROR_CODE_RE.test(i.text))) return "short_error_code_merged";
  return "short_section_merged";
}

function inferUnitType(label: string): string {
  if (label.includes("list")) return "사용 절차";
  if (label.includes("header") || label.includes("title") || label.includes("heading")) {
    return "개념 설명";
  }
  return "기능 설명";
}

function classifyNormalExclusion(
  section: FlatSection,
  repeatCounts: Map<string, number>,
): string | null {
  if (!section.text) return "empty_section";
  if (section.label === "page_number" || isPageNumberText(section.text, section.label)) {
    return "page_number";
  }
  if (isFurnitureLabel(section.label)) {
    return section.label.includes("footer") ? "repeated_footer" : "repeated_header";
  }
  if (isDecorativeText(section.text)) return "decorative_text";
  const key = normalizeForDup(section.text);
  if (key.length > 0 && key.length <= 80 && (repeatCounts.get(key) ?? 0) >= 3) {
    return section.label.includes("footer") ? "repeated_footer" : "repeated_header";
  }
  if (section.childTexts.length > 0 && !section.uniqueText) {
    return "duplicate_parent_text";
  }
  return null;
}

function isMeaningfulShortProse(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return false;
  if (isDecorativeText(t) || isPageNumberText(t)) return false;
  return /[가-힣A-Za-z]{2,}/.test(t);
}

type WorkItem = {
  section: FlatSection;
  workText: string;
};

function sameParentPath(a: FlatSection, b: FlatSection): boolean {
  if (a.path.length < 2 || b.path.length < 2) return a.path[0] === b.path[0];
  return a.path.slice(0, -1).join(">") === b.path.slice(0, -1).join(">");
}

function flushBuffer(
  buffer: WorkItem[],
  units: PlannedBodyUnit[],
  metrics: { shortSectionMergedCount: number; shortValidUnitCount: number },
  exclusions: ExclusionReasonMap,
): void {
  if (buffer.length === 0) return;

  const combined = buffer
    .map((b) => b.workText)
    .join("\n\n")
    .trim();
  const ids = buffer.map((b) => b.section.id);
  const path = buffer[0]!.section.path;
  const pathLabel = buffer[0]!.section.pathLabel;
  const pages = buffer.map((b) => b.section.page).filter((p): p is number => p != null);
  const pageStart = pages.length ? Math.min(...pages) : buffer[0]!.section.page;
  const pageEnd = pages.length ? Math.max(...pages) : buffer[0]!.section.page;
  const label = buffer[0]!.section.label;
  const title =
    buffer.map((b) => b.section.title).filter(Boolean)[0] ||
    path[path.length - 1] ||
    "본문";

  if (!combined) {
    for (const b of buffer) {
      bumpExclusionReason(exclusions, "empty_section", b.section.text);
    }
    buffer.length = 0;
    return;
  }

  if (combined.length < DOCLING_KU_MIN_CHARS) {
    if (
      buffer.length === 1 &&
      (isStandAloneShortUnitEligible(combined, label) || isMeaningfulShortProse(combined))
    ) {
      metrics.shortValidUnitCount += 1;
      bumpExclusionReason(exclusions, "short_valid_unit", combined, 0);
      units.push({
        title: title.slice(0, 120),
        text: combined,
        path,
        pathLabel,
        pageStart,
        pageEnd,
        sourceSectionIds: ids,
        sourceTextRanges: [{ sectionId: ids[0]!, start: 0, end: combined.length }],
        mergeReason: null,
        unitType: inferUnitType(label),
        startOffset: 0,
        endOffset: combined.length,
        shortValidUnit: true,
      });
      buffer.length = 0;
      return;
    }

    const meaningful = buffer.some(
      (b) =>
        isStandAloneShortUnitEligible(b.workText, b.section.label) ||
        isMeaningfulShortProse(b.workText),
    );
    const reason = meaningful ? "critical_unmerged_short_section" : "decorative_text";
    for (const b of buffer) {
      bumpExclusionReason(exclusions, reason, b.workText);
    }
    buffer.length = 0;
    return;
  }

  if (buffer.length > 1) {
    metrics.shortSectionMergedCount += buffer.length;
    const mergeReason = inferMergeReason(buffer.map((b) => b.section));
    bumpExclusionReason(exclusions, mergeReason, combined, 0);
    let offset = 0;
    const ranges = buffer.map((b) => {
      const start = offset;
      const end = start + b.workText.length;
      offset = end + 2;
      return { sectionId: b.section.id, start, end };
    });
    units.push({
      title: title.slice(0, 120),
      text: combined,
      path,
      pathLabel,
      pageStart,
      pageEnd,
      sourceSectionIds: ids,
      sourceTextRanges: ranges,
      mergeReason,
      unitType: inferUnitType(label),
      startOffset: 0,
      endOffset: combined.length,
      shortValidUnit: false,
    });
  } else {
    const only = buffer[0]!;
    if (only.workText.length < DOCLING_KU_MIN_CHARS) {
      metrics.shortValidUnitCount += 1;
      bumpExclusionReason(exclusions, "short_valid_unit", only.workText, 0);
    }
    units.push({
      title: title.slice(0, 120),
      text: only.workText,
      path,
      pathLabel,
      pageStart,
      pageEnd,
      sourceSectionIds: ids,
      sourceTextRanges: [{ sectionId: ids[0]!, start: 0, end: only.workText.length }],
      mergeReason: null,
      unitType: inferUnitType(only.section.label),
      startOffset: 0,
      endOffset: only.workText.length,
      shortValidUnit: only.workText.length < DOCLING_KU_MIN_CHARS,
    });
  }
  buffer.length = 0;
}

function tryMergeIntoNext(pending: WorkItem[], next: WorkItem): boolean {
  if (pending.length === 0) return false;
  const last = pending[pending.length - 1]!;
  if (next.workText.length >= DOCLING_KU_MIN_CHARS) return true;
  if (sameParentPath(last.section, next.section)) return true;
  if (last.section.label.includes("list") && next.section.label.includes("list")) {
    return true;
  }
  if (WARNING_KW_RE.test(last.workText) || ERROR_CODE_RE.test(last.workText)) {
    return true;
  }
  return false;
}

/**
 * Plan body knowledge units with short-section merges and coverage metrics.
 * Long splits happen later via splitSectionIntoUnitTexts.
 */
export function planDoclingBodyKnowledgeUnits(sections: NdSectionLike[]): {
  units: PlannedBodyUnit[];
  metrics: BodyPlanMetrics;
} {
  const flat = flattenSections(sections);
  const repeatCounts = new Map<string, number>();
  for (const s of flat) {
    const key = normalizeForDup(s.text);
    if (!key || key.length > 80) continue;
    repeatCounts.set(key, (repeatCounts.get(key) ?? 0) + 1);
  }

  const exclusions: ExclusionReasonMap = {};
  let rawBodyChars = 0;
  let normalExcludedBodyChars = 0;

  const work: WorkItem[] = [];
  for (const section of flat) {
    rawBodyChars += section.text.length;

    if (section.childTexts.length > 0) {
      const dupChars = Math.max(0, section.text.length - section.uniqueText.length);
      const excludeChars = section.uniqueText ? dupChars : section.text.length;
      if (excludeChars > 0 || !section.uniqueText) {
        bumpExclusionReason(
          exclusions,
          "duplicate_parent_text",
          section.text,
          excludeChars || section.text.length,
        );
        normalExcludedBodyChars += excludeChars || section.text.length;
      }
      if (section.uniqueText) {
        work.push({
          section: { ...section, text: section.uniqueText },
          workText: section.uniqueText,
        });
      }
      continue;
    }

    const normalReason = classifyNormalExclusion(section, repeatCounts);
    if (normalReason) {
      bumpExclusionReason(exclusions, normalReason, section.text, section.text.length);
      normalExcludedBodyChars += section.text.length;
      continue;
    }
    if (!section.text) {
      bumpExclusionReason(exclusions, "empty_section", section.text);
      normalExcludedBodyChars += section.text.length;
      continue;
    }
    work.push({ section, workText: section.text });
  }

  const units: PlannedBodyUnit[] = [];
  const mergeMetrics = { shortSectionMergedCount: 0, shortValidUnitCount: 0 };
  const buffer: WorkItem[] = [];

  for (let i = 0; i < work.length; i += 1) {
    const item = work[i]!;
    const len = item.workText.length;

    if (len >= DOCLING_KU_MIN_CHARS) {
      if (buffer.length > 0 && tryMergeIntoNext(buffer, item)) {
        const mergeReason = inferMergeReason([
          ...buffer.map((b) => b.section),
          item.section,
        ]);
        const mergedText = [...buffer.map((b) => b.workText), item.workText].join("\n\n");
        mergeMetrics.shortSectionMergedCount += buffer.length;
        bumpExclusionReason(exclusions, mergeReason, mergedText, 0);
        const ids = [...buffer.map((b) => b.section.id), item.section.id];
        const pages = [...buffer, item]
          .map((b) => b.section.page)
          .filter((p): p is number => p != null);
        let offset = 0;
        const ranges = [...buffer, item].map((b) => {
          const start = offset;
          const end = start + b.workText.length;
          offset = end + 2;
          return { sectionId: b.section.id, start, end };
        });
        units.push({
          title: (buffer[0]!.section.title || item.section.title).slice(0, 120),
          text: mergedText,
          path: item.section.path,
          pathLabel: item.section.pathLabel,
          pageStart: pages.length ? Math.min(...pages) : item.section.page,
          pageEnd: pages.length ? Math.max(...pages) : item.section.page,
          sourceSectionIds: ids,
          sourceTextRanges: ranges,
          mergeReason,
          unitType: inferUnitType(item.section.label),
          startOffset: 0,
          endOffset: mergedText.length,
          shortValidUnit: false,
        });
        buffer.length = 0;
        continue;
      }
      flushBuffer(buffer, units, mergeMetrics, exclusions);
      units.push({
        title: item.section.title.slice(0, 120),
        text: item.workText,
        path: item.section.path,
        pathLabel: item.section.pathLabel,
        pageStart: item.section.page,
        pageEnd: item.section.page,
        sourceSectionIds: [item.section.id],
        sourceTextRanges: [
          { sectionId: item.section.id, start: 0, end: item.workText.length },
        ],
        mergeReason: null,
        unitType: inferUnitType(item.section.label),
        startOffset: 0,
        endOffset: item.workText.length,
        shortValidUnit: false,
      });
      continue;
    }

    buffer.push(item);
    const next = work[i + 1];
    if (!next) {
      flushBuffer(buffer, units, mergeMetrics, exclusions);
      continue;
    }
    if (next.workText.length >= DOCLING_KU_MIN_CHARS && tryMergeIntoNext(buffer, next)) {
      continue;
    }
    if (
      next.workText.length < DOCLING_KU_MIN_CHARS &&
      (sameParentPath(item.section, next.section) ||
        (item.section.label.includes("list") && next.section.label.includes("list")) ||
        WARNING_KW_RE.test(item.workText) ||
        ERROR_CODE_RE.test(item.workText))
    ) {
      continue;
    }
    flushBuffer(buffer, units, mergeMetrics, exclusions);
  }
  flushBuffer(buffer, units, mergeMetrics, exclusions);

  let criticalExcludedBodyChars = 0;
  for (const [reason, detail] of Object.entries(exclusions)) {
    if (reason === "critical_unmerged_short_section" || reason === "provenance_missing") {
      criticalExcludedBodyChars += detail.charCount;
    }
  }

  const unitBodyChars = units.reduce((sum, u) => sum + u.text.length, 0);
  const eligibleBodyChars = Math.max(0, rawBodyChars - normalExcludedBodyChars);
  const rawBodyCoverage =
    rawBodyChars > 0 ? Math.min(1, unitBodyChars / rawBodyChars) : 1;
  const eligibleBodyCoverage =
    eligibleBodyChars > 0 ? Math.min(1, unitBodyChars / eligibleBodyChars) : 1;

  return {
    units,
    metrics: {
      rawBodyChars,
      eligibleBodyChars,
      unitBodyChars,
      normalExcludedBodyChars,
      criticalExcludedBodyChars,
      rawBodyCoverage,
      eligibleBodyCoverage,
      shortSectionMergedCount: mergeMetrics.shortSectionMergedCount,
      shortValidUnitCount: mergeMetrics.shortValidUnitCount,
      exclusionReasons: exclusions,
    },
  };
}

export function evaluateKnowledgeUnitStepStatus(input: {
  unitCount: number;
  eligibleBodyCoverage: number;
  tableCoverage: number;
  provenanceMissing: number;
  criticalExcludedChars: number;
}): "PASS" | "WARNING" | "FAIL" {
  const {
    unitCount,
    eligibleBodyCoverage,
    tableCoverage,
    provenanceMissing,
    criticalExcludedChars,
  } = input;

  if (
    unitCount <= 0 ||
    provenanceMissing > 0 ||
    criticalExcludedChars > 0 ||
    eligibleBodyCoverage < DOCLING_KU_PASS_THRESHOLDS.eligibleBodyCoverageWarn ||
    tableCoverage < DOCLING_KU_PASS_THRESHOLDS.tableCoverageWarn
  ) {
    return "FAIL";
  }

  if (
    eligibleBodyCoverage >= DOCLING_KU_PASS_THRESHOLDS.eligibleBodyCoveragePass &&
    tableCoverage >= DOCLING_KU_PASS_THRESHOLDS.tableCoveragePass
  ) {
    return "PASS";
  }

  return "WARNING";
}

export function exclusionReasonCounts(map: ExclusionReasonMap): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) out[k] = v.count;
  return out;
}
