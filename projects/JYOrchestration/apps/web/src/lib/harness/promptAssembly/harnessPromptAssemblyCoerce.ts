/**
 * Harness Phase H1 — **replay coercer**.
 *
 * timeline replay/diagnostic API에서 unknown raw JSON을 `HarnessPromptAssemblyPreview`/
 * `HarnessPromptPreviewDiff`로 **안전하게 정규화**한다. 잘못된 데이터는 모두 omit하여
 * 기존 timeline row가 깨지지 않도록 한다.
 *
 * **read-only.** prompt 본문/라우팅/payload 어느 것도 변경하지 않는다.
 */

import {
  HARNESS_PROMPT_PREVIEW_WARNINGS_MAX,
  HARNESS_PROMPT_SECTION_CONTENT_MAX,
  HARNESS_PROMPT_SECTION_ORDER,
  HARNESS_PROMPT_SECTIONS_MAX,
  type HarnessPromptAssemblyPreview,
  type HarnessPromptOverflowRisk,
  type HarnessPromptPreviewDiff,
  type HarnessPromptSection,
  type HarnessPromptSectionType,
} from "./harnessPromptAssemblyTypes";
import { coerceNonNegInt, trimAndClipString } from "./internal/harnessPromptAssemblyStrings";

const VALID_SECTION_TYPES = new Set<HarnessPromptSectionType>(HARNESS_PROMPT_SECTION_ORDER);
const VALID_OVERFLOW_RISKS = new Set<HarnessPromptOverflowRisk>(["low", "medium", "high"]);

const ID_MAX = 64;
const TITLE_MAX = 80;
const SOURCE_MAX = 240;
const REASON_MAX = 200;
const WARNING_MAX = 400;

function coerceSection(raw: unknown): HarnessPromptSection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = typeof r.type === "string" ? (r.type as HarnessPromptSectionType) : null;
  if (!type || !VALID_SECTION_TYPES.has(type)) return null;
  const id = trimAndClipString(r.id, ID_MAX);
  const title = trimAndClipString(r.title, TITLE_MAX);
  const content = trimAndClipString(r.content, HARNESS_PROMPT_SECTION_CONTENT_MAX);
  const source = trimAndClipString(r.source, SOURCE_MAX);
  const includeReason = trimAndClipString(r.includeReason, REASON_MAX);
  if (!id || !title) return null;
  return {
    id,
    type,
    title,
    content,
    source,
    includeReason,
    priority: coerceNonNegInt(r.priority),
    estimatedCost: coerceNonNegInt(r.estimatedCost),
  };
}

function coerceWarningArray(raw: unknown): readonly string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const t = trimAndClipString(item, WARNING_MAX);
    if (t) out.push(t);
    if (out.length >= HARNESS_PROMPT_PREVIEW_WARNINGS_MAX) break;
  }
  return out;
}

function coerceSectionTypeArray(raw: unknown): readonly HarnessPromptSectionType[] {
  if (!Array.isArray(raw)) return [];
  const out: HarnessPromptSectionType[] = [];
  const seen = new Set<HarnessPromptSectionType>();
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const t = item.trim() as HarnessPromptSectionType;
    if (!VALID_SECTION_TYPES.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * unknown raw → `HarnessPromptAssemblyPreview` (또는 null).
 * `mode`가 `"dry_run"`이 아니면 거부.
 */
export function parseHarnessPromptAssemblyPreviewFromUnknown(
  raw: unknown
): HarnessPromptAssemblyPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.mode !== "dry_run") return null;
  const sectionsRaw = Array.isArray(r.sections) ? r.sections : [];
  const sections: HarnessPromptSection[] = [];
  for (const item of sectionsRaw) {
    const s = coerceSection(item);
    if (s) sections.push(s);
    if (sections.length >= HARNESS_PROMPT_SECTIONS_MAX) break;
  }
  const risk = typeof r.overflowRisk === "string" ? (r.overflowRisk as HarnessPromptOverflowRisk) : "low";
  const overflowRisk: HarnessPromptOverflowRisk = VALID_OVERFLOW_RISKS.has(risk) ? risk : "low";
  return {
    mode: "dry_run",
    sections,
    totalEstimatedCost: coerceNonNegInt(r.totalEstimatedCost),
    overflowRisk,
    warnings: coerceWarningArray(r.warnings),
  };
}

/**
 * unknown raw → `HarnessPromptPreviewDiff` (또는 null).
 */
export function parseHarnessPromptPreviewDiffFromUnknown(
  raw: unknown
): HarnessPromptPreviewDiff | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    existingPromptLength: coerceNonNegInt(r.existingPromptLength),
    previewLength: coerceNonNegInt(r.previewLength),
    sectionCount: coerceNonNegInt(r.sectionCount),
    missingSectionTypes: coerceSectionTypeArray(r.missingSectionTypes),
    extraSectionTypes: coerceSectionTypeArray(r.extraSectionTypes),
    warnings: coerceWarningArray(r.warnings),
  };
}

/**
 * Harness optional metadata 묶음.
 *
 * - 단일 dispatcher: `overlayPromptTraceExtract` / `requirementsIdeationBootstrapPromptTimeline`
 *   양쪽에서 동일한 정규화 규칙을 공유하도록 한 출처에서 export.
 */
export type CoercedHarnessPromptAssemblyMetadata = Readonly<{
  harnessPromptAssemblyPreview?: HarnessPromptAssemblyPreview;
  harnessPromptPreviewDiff?: HarnessPromptPreviewDiff;
}>;

export function coerceHarnessPromptAssemblyMetadata(
  raw: Record<string, unknown> | null | undefined
): CoercedHarnessPromptAssemblyMetadata {
  if (!raw || typeof raw !== "object") return {};
  const out: {
    harnessPromptAssemblyPreview?: HarnessPromptAssemblyPreview;
    harnessPromptPreviewDiff?: HarnessPromptPreviewDiff;
  } = {};
  const preview = parseHarnessPromptAssemblyPreviewFromUnknown(raw.harnessPromptAssemblyPreview);
  if (preview) out.harnessPromptAssemblyPreview = preview;
  const diff = parseHarnessPromptPreviewDiffFromUnknown(raw.harnessPromptPreviewDiff);
  if (diff) out.harnessPromptPreviewDiff = diff;
  return out;
}
