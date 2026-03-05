import { nanoid } from "nanoid";
import { buildDocumentBlocks } from "@/lib/chunking/blockBuilder";
import type { Block } from "@/lib/chunking/types";
import type { TemplateSchema } from "@/lib/template/schema";
import { detectDocumentType, type AutoDocType } from "./layoutClassifier";
import {
  LABEL_DICTIONARY,
  SECTION_KEYWORDS,
  canonicalizeLabel,
} from "./labelDictionary";
import { normalizeDate, normalizeLabel, normalizeText } from "./normalize";

export interface CandidateBBox {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FieldCandidate {
  label: string;
  bbox: CandidateBBox;
  confidence: number;
  sectionHint?: string;
}

export interface SectionCandidate {
  title: string;
  bbox: CandidateBBox;
  confidence: number;
  level?: number;
}

export interface TableCandidate {
  name: string;
  headerLabels: string[];
  bbox: CandidateBBox;
  confidence: number;
}

export interface TemplateAutoDetectResult {
  docType: AutoDocType;
  confidence: number;
  sections: SectionCandidate[];
  fields: FieldCandidate[];
  tables: TableCandidate[];
}

export interface TemplateAutoDetectDebugInfo {
  reasons: string[];
  topSignals: string[];
  matchedLabels: string[];
}

function blockBBox(index: number, total: number, wide = false): CandidateBBox {
  const y = total > 1 ? index / total : 0.1;
  return {
    page: 1,
    x: 0.08,
    y: Math.min(0.95, Math.max(0.02, y)),
    w: wide ? 0.84 : 0.4,
    h: 0.035,
  };
}

function toFieldLabelByDict(text: string): string | null {
  for (const label of LABEL_DICTIONARY) {
    if (text.includes(label)) return label;
  }
  return null;
}

export function detectFieldCandidates(blocks: Block[]): FieldCandidate[] {
  const out: Array<FieldCandidate & { canonical: string; score: number; rawSignals: string[] }> =
    [];
  const total = Math.max(1, blocks.length);
  const labelFreq = new Map<string, number>();
  for (const block of blocks) {
    const lv = normalizeText(block.text).match(/^([가-힣A-Za-z][^:：]{0,30})\s*[:：]\s*(.+)$/);
    if (!lv) continue;
    const canonical = canonicalizeLabel(lv[1]) ?? normalizeLabel(lv[1]);
    labelFreq.set(canonical, (labelFreq.get(canonical) ?? 0) + 1);
  }

  for (const block of blocks) {
    const text = normalizeText(block.text);
    if (!text) continue;
    const rawSignals: string[] = [];
    let score = 0;
    let detectedLabel: string | null = null;

    const lv = text.match(/^([가-힣A-Za-z][^:：]{0,30})\s*[:：]\s*(.+)$/);
    if (lv) {
      detectedLabel = lv[1];
      score += 0.5;
      rawSignals.push("label:value pattern");
      if (/:|：/.test(text)) {
        score += 0.15;
        rawSignals.push("colon proximity");
      }
    }

    const byDict = toFieldLabelByDict(text);
    if (!detectedLabel && byDict) {
      detectedLabel = byDict;
    }
    if (byDict) {
      score += 0.2;
      rawSignals.push("dictionary match");
    }

    if (block.type === "table" && block.tableStruct) {
      const rows = block.tableStruct.rows.slice(0, 10);
      for (const row of rows) {
        const left = row[0]?.trim();
        if (!left) continue;
        const label = canonicalizeLabel(left) ?? normalizeLabel(left);
        if (!label) continue;
        out.push({
          label,
          bbox: blockBBox(block.blockIndex, total),
          confidence: 0.88,
          canonical: label,
          score: 0.88,
          rawSignals: ["table left-column label", "dictionary/normalized match"],
        });
      }
    }

    if (detectedLabel) {
      const canonical = canonicalizeLabel(detectedLabel) ?? normalizeLabel(detectedLabel);
      const freq = labelFreq.get(canonical) ?? 1;
      score += Math.min(0.08, (freq - 1) * 0.02);
      if (freq > 1) rawSignals.push("label frequency");
      const normalizedValue = normalizeDate(lv?.[2] ?? "");
      if (normalizedValue && normalizedValue !== (lv?.[2] ?? "")) {
        score += 0.04;
        rawSignals.push("date normalized");
      }
      const confidence = Number(Math.min(0.98, Math.max(0.45, score)).toFixed(2));
      out.push({
        label: canonical,
        bbox: blockBBox(block.blockIndex, total),
        confidence,
        canonical,
        score: confidence,
        rawSignals,
      });
    }
  }

  const unique = new Map<string, (typeof out)[number]>();
  for (const candidate of out) {
    const key = candidate.canonical.toLowerCase();
    const prev = unique.get(key);
    if (!prev || prev.score < candidate.score) unique.set(key, candidate);
  }
  return Array.from(unique.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 40)
    .map((candidate) => ({
      label: candidate.label,
      bbox: candidate.bbox,
      confidence: candidate.confidence,
    }));
}

export function detectSectionCandidates(blocks: Block[]): SectionCandidate[] {
  const total = Math.max(1, blocks.length);
  const candidates: Array<SectionCandidate & { key: string }> = [];
  for (const block of blocks) {
    const text = normalizeText(block.text);
    if (!text) continue;
    const looksHeading =
      block.type === "heading" ||
      /^(제?\s*\d+\s*(장|절|조)|\d+(\.\d+){0,3}[\.)]?|[가-힣]\.|[IVX]+\.|[가-힣A-Za-z ]{2,30})$/.test(
        text
      );
    const keywordHit = SECTION_KEYWORDS.find((k) => text.includes(k));
    if (!looksHeading && !keywordHit) continue;
    const key = normalizeLabel(text);
    const confidence = looksHeading ? 0.86 : 0.74;
    candidates.push({
      title: text.replace(/[:：]+$/, ""),
      bbox: blockBBox(block.blockIndex, total, true),
      confidence,
      level: block.type === "heading" ? block.level ?? 1 : 1,
      key,
    });
  }
  const unique = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const prev = unique.get(candidate.key);
    if (!prev || prev.confidence < candidate.confidence) unique.set(candidate.key, candidate);
  }
  return Array.from(unique.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20)
    .map((candidate) => {
      const { key: _discardedKey, ...rest } = candidate;
      void _discardedKey;
      return rest;
    });
}

export function generateDraftTemplate(input: {
  profile: TemplateAutoDetectResult;
  family: string;
  name?: string;
}): TemplateSchema {
  const now = new Date().toISOString();
  const templateId = nanoid(10);
  const sectionCandidates =
    input.profile.sections.length > 0
      ? input.profile.sections
      : [
          {
            title: "기본 섹션",
            bbox: blockBBox(0, 1, true),
            confidence: 0.5,
            level: 1,
          },
        ];

  const sections = sectionCandidates.map((section, idx) => ({
    id: `sec_${idx + 1}`,
    title: section.title,
    level: Math.max(1, Math.min(6, section.level ?? 1)),
    required: true,
    orderHint: idx + 1,
    bboxHint: section.bbox,
  }));

  const fields = input.profile.fields.slice(0, 30).map((field, idx) => ({
    key: `field_${idx + 1}`,
    label: field.label,
    required: false,
    sectionId: sections[0]?.id,
    bboxHint: field.bbox,
  }));

  const tables = input.profile.tables.slice(0, 10).map((table, idx) => ({
    id: `tbl_${idx + 1}`,
    sectionId: sections[0]?.id,
    headerLabels: table.headerLabels,
    required: false,
    bboxHint: table.bbox,
  }));

  return {
    templateId,
    name: input.name ?? "자동 감지 템플릿 초안",
    family: input.family,
    docType: input.profile.docType,
    version: "v0.1",
    anchors: [],
    sections,
    fields,
    tables,
    repeatBlocks: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function autoDetectTemplateFromText(text: string): {
  result: TemplateAutoDetectResult;
  debug: TemplateAutoDetectDebugInfo;
} {
  const normalized = normalizeText(text);
  const { blocks, tables } = buildDocumentBlocks(normalized);
  const fields = detectFieldCandidates(blocks);
  const sections = detectSectionCandidates(blocks);
  const tableCandidates: TableCandidate[] = tables.map((table, idx) => ({
    name: table.caption || `표 ${idx + 1}`,
    headerLabels: table.header ?? table.rows[0] ?? [],
    bbox: blockBBox(idx, Math.max(1, tables.length), true),
    confidence: 0.8,
  }));
  const labelValuePairs = blocks.filter((block) =>
    /^[^:：]{1,30}\s*[:：]\s*.+$/.test(normalizeText(block.text))
  ).length;
  const docType = detectDocumentType({
    text: normalized,
    tableCount: tables.length,
    labelValuePairs,
    hasSignature: /(서명|결재|승인|signature)/i.test(normalized),
    hasDateField: /(작성일|입사일|사직예정일|날짜|date)/i.test(normalized),
  });

  const confidenceBase =
    (sections.length > 0 ? 0.35 : 0) +
    (fields.length > 0 ? 0.35 : 0) +
    (tableCandidates.length > 0 ? 0.2 : 0) +
    (docType !== "unknown" ? 0.1 : 0);

  const result: TemplateAutoDetectResult = {
    docType,
    confidence: Number(Math.min(0.98, confidenceBase).toFixed(2)),
    sections,
    fields,
    tables: tableCandidates,
  };
  const debug: TemplateAutoDetectDebugInfo = {
    reasons: [
      `docType=${docType}`,
      `tableCount=${tables.length}`,
      `labelValuePairs=${labelValuePairs}`,
    ],
    topSignals: [
      sections.length > 0 ? "heading/section signals" : "no strong headings",
      fields.length > 0 ? "field dictionary + pattern signals" : "few field signals",
      tableCandidates.length > 0 ? "table structure signals" : "few table signals",
    ],
    matchedLabels: fields.slice(0, 10).map((field) => field.label),
  };
  return { result, debug };
}
