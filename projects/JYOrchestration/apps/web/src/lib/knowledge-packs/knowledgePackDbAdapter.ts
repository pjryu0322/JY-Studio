import { DEVELOPER_SEED_KNOWLEDGE_PACKS } from "@/lib/knowledge-packs/developerKnowledgePacks";
import type {
  KnowledgePack,
  KnowledgePackAgent,
  KnowledgePackCategory,
  KnowledgePackLicenseType,
  KnowledgePackStatus,
} from "@/lib/knowledge-packs/types";

export const STATIC_KNOWLEDGE_PACK_IDS = new Set(DEVELOPER_SEED_KNOWLEDGE_PACKS.map((p) => p.id));

export function isStaticKnowledgePackId(id: string): boolean {
  return STATIC_KNOWLEDGE_PACK_IDS.has(id.trim());
}

export type KnowledgePackSectionKey =
  | "SUMMARY"
  | "RECOMMENDED_USE_CASES"
  | "NOT_RECOMMENDED_USE_CASES"
  | "CAPABILITIES"
  | "CONSTRAINTS"
  | "IMPLEMENTATION_GUIDELINES"
  | "CURSOR_PROMPT_RULES"
  | "FORBIDDEN_PATTERNS"
  | "REVIEW_CHECKLIST"
  | "SECURITY_CHECKLIST"
  | "ALTERNATIVES"
  | "REFERENCES"
  | "PREVIEW_SPEC";

/** 줄바꿈 기준 배열 — 빈 줄 제거 */
export function parseLines(text: string): string[] {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** `라벨 | URL` 줄 단위 */
export function parseReferences(text: string): { label: string; url: string }[] {
  const out: { label: string; url: string }[] = [];
  for (const line of parseLines(text)) {
    const pipe = line.indexOf("|");
    if (pipe <= 0) continue;
    const label = line.slice(0, pipe).trim();
    const url = line.slice(pipe + 1).trim();
    if (!label || !url) continue;
    out.push({ label, url });
  }
  return out;
}

export function formatReferences(refs: readonly { label: string; url: string }[]): string {
  return refs.map((r) => `${r.label} | ${r.url}`).join("\n");
}

function contentToLines(content: string | undefined | null): string[] {
  return parseLines(content ?? "");
}

const LICENSE_DB_TO_UI: Record<string, KnowledgePackLicenseType> = {
  MIT: "MIT",
  OPEN_SOURCE: "OPEN_SOURCE",
  COMMERCIAL: "COMMERCIAL",
  PARTNER_LICENSE: "COMMERCIAL",
  USER_PROVIDED_LICENSE: "UNKNOWN",
  EXTERNAL_SERVICE: "EXTERNAL_SERVICE",
  UNKNOWN: "UNKNOWN",
};

export function normalizeDbLicenseType(raw: string): KnowledgePackLicenseType {
  return LICENSE_DB_TO_UI[raw] ?? "UNKNOWN";
}

const STATUS_ALLOW: KnowledgePackStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED", "REVIEW_REQUESTED", "APPROVED"];

export function normalizeDbStatus(raw: string): KnowledgePackStatus {
  return (STATUS_ALLOW.includes(raw as KnowledgePackStatus) ? raw : "DRAFT") as KnowledgePackStatus;
}

export type SectionPayload = Readonly<{
  recommendedUseCases?: string;
  notRecommendedUseCases?: string;
  capabilities?: string;
  constraints?: string;
  implementationGuidelines?: string;
  cursorPromptRules?: string;
  forbiddenPatterns?: string;
  reviewChecklist?: string;
  securityChecklist?: string;
  alternatives?: string;
  references?: string;
  previewSpec?: string;
}>;

/** DB 저장 시 라이선스 메모를 CONSTRAINTS와 분리해 보존 */
export function buildConstraintsSectionContent(
  licenseNotes: readonly string[],
  constraintLines: readonly string[]
): string {
  const prefix = licenseNotes.map((n) => `__LICENSE_NOTE__: ${n}`);
  return [...prefix, ...constraintLines].join("\n");
}

export function knowledgePackFieldsToSections(
  summary: string,
  licenseNotes: readonly string[],
  sections: SectionPayload
): { key: KnowledgePackSectionKey; content: string; sortOrder: number }[] {
  const rows: { key: KnowledgePackSectionKey; content: string; sortOrder: number }[] = [
    { key: "SUMMARY", content: summary.trim(), sortOrder: 0 },
    { key: "RECOMMENDED_USE_CASES", content: sections.recommendedUseCases ?? "", sortOrder: 10 },
    { key: "NOT_RECOMMENDED_USE_CASES", content: sections.notRecommendedUseCases ?? "", sortOrder: 20 },
    { key: "CAPABILITIES", content: sections.capabilities ?? "", sortOrder: 30 },
    {
      key: "CONSTRAINTS",
      content: buildConstraintsSectionContent(licenseNotes, parseLines(sections.constraints ?? "")),
      sortOrder: 40,
    },
    { key: "IMPLEMENTATION_GUIDELINES", content: sections.implementationGuidelines ?? "", sortOrder: 50 },
    { key: "CURSOR_PROMPT_RULES", content: sections.cursorPromptRules ?? "", sortOrder: 60 },
    { key: "FORBIDDEN_PATTERNS", content: sections.forbiddenPatterns ?? "", sortOrder: 70 },
    { key: "REVIEW_CHECKLIST", content: sections.reviewChecklist ?? "", sortOrder: 80 },
    { key: "SECURITY_CHECKLIST", content: sections.securityChecklist ?? "", sortOrder: 90 },
    { key: "ALTERNATIVES", content: sections.alternatives ?? "", sortOrder: 100 },
    { key: "REFERENCES", content: sections.references ?? "", sortOrder: 110 },
    { key: "PREVIEW_SPEC", content: sections.previewSpec ?? "", sortOrder: 120 },
  ];
  return rows;
}

export function sectionsMapToKnowledgePackFields(sectionRows: ReadonlyArray<{ sectionKey: string; content: string }>): {
  summaryLines: string[];
  recommendedUseCases: string[];
  notRecommendedUseCases: string[];
  capabilities: string[];
  constraints: string[];
  licenseNotesFromConstraints: string[];
  implementationGuidelines: string[];
  cursorPromptRules: string[];
  forbiddenPatterns: string[];
  reviewChecklist: string[];
  securityChecklist: string[];
  alternatives: string[];
  referencesRaw: string;
  previewSpec: string;
} {
  const map = new Map<string, string>();
  for (const r of sectionRows) {
    map.set(r.sectionKey, r.content ?? "");
  }
  const constraintsAll = contentToLines(map.get("CONSTRAINTS"));
  const licenseNotesFromConstraints: string[] = [];
  const constraints: string[] = [];
  for (const line of constraintsAll) {
    if (line.startsWith("__LICENSE_NOTE__:")) {
      licenseNotesFromConstraints.push(line.replace(/^__LICENSE_NOTE__:\s*/, ""));
    } else {
      constraints.push(line);
    }
  }
  return {
    summaryLines: contentToLines(map.get("SUMMARY")),
    recommendedUseCases: contentToLines(map.get("RECOMMENDED_USE_CASES")),
    notRecommendedUseCases: contentToLines(map.get("NOT_RECOMMENDED_USE_CASES")),
    capabilities: contentToLines(map.get("CAPABILITIES")),
    constraints,
    licenseNotesFromConstraints,
    implementationGuidelines: contentToLines(map.get("IMPLEMENTATION_GUIDELINES")),
    cursorPromptRules: contentToLines(map.get("CURSOR_PROMPT_RULES")),
    forbiddenPatterns: contentToLines(map.get("FORBIDDEN_PATTERNS")),
    reviewChecklist: contentToLines(map.get("REVIEW_CHECKLIST")),
    securityChecklist: contentToLines(map.get("SECURITY_CHECKLIST")),
    alternatives: contentToLines(map.get("ALTERNATIVES")),
    referencesRaw: map.get("REFERENCES") ?? "",
    previewSpec: map.get("PREVIEW_SPEC") ?? "",
  };
}

export function dbRowToKnowledgePack(
  row: Readonly<{
    id: string;
    name: string;
    scope: string;
    category: string;
    summary: string;
    description: string;
    vendor: string;
    licenseType: string;
    status: string;
    currentVersion: { version: string; sections: readonly { sectionKey: string; content: string }[] } | null;
    agentsJson: string;
  }>
): KnowledgePack {
  const ver = row.currentVersion;
  const versionStr = ver?.version ?? "1.0.0";
  const sec = ver?.sections ?? [];
  const f = sectionsMapToKnowledgePackFields(sec);
  const summaryText = f.summaryLines.length ? f.summaryLines.join("\n") : row.summary;
  let agents: KnowledgePackAgent[] = ["AI_DEVELOPER"];
  try {
    const parsed = JSON.parse(row.agentsJson) as unknown;
    if (Array.isArray(parsed)) {
      agents = parsed.filter((x): x is KnowledgePackAgent => typeof x === "string") as KnowledgePackAgent[];
      if (!agents.length) agents = ["AI_DEVELOPER"];
    }
  } catch {
    /* noop */
  }
  const licType = normalizeDbLicenseType(row.licenseType);
  const licenseNotes =
    f.licenseNotesFromConstraints.length > 0 ? f.licenseNotesFromConstraints : [`라이선스 유형: ${row.licenseType}`];

  return {
    id: row.id,
    name: row.name,
    version: versionStr,
    scope: row.scope as KnowledgePack["scope"],
    category: row.category as KnowledgePackCategory,
    agents,
    status: normalizeDbStatus(row.status),
    summary: summaryText,
    description: row.description,
    vendor: row.vendor,
    license: { type: licType, notes: licenseNotes },
    recommendedUseCases: f.recommendedUseCases,
    notRecommendedUseCases: f.notRecommendedUseCases,
    capabilities: f.capabilities,
    constraints: f.constraints,
    implementationGuidelines: f.implementationGuidelines,
    cursorPromptRules: f.cursorPromptRules,
    forbiddenPatterns: f.forbiddenPatterns,
    reviewChecklist: f.reviewChecklist,
    alternatives: f.alternatives,
    references: parseReferences(f.referencesRaw),
    source: "DB",
    editable: true,
    securityChecklist: f.securityChecklist,
    previewSpec: f.previewSpec.trim() || undefined,
  };
}

export function mergeStaticAndDbKnowledgePacks(
  staticPacks: readonly KnowledgePack[],
  dbPacks: readonly KnowledgePack[]
): KnowledgePack[] {
  const seen = new Set<string>();
  const out: KnowledgePack[] = [];
  for (const p of staticPacks) {
    const wire: KnowledgePack = {
      ...p,
      source: "STATIC",
      editable: false,
    };
    out.push(wire);
    seen.add(p.id);
  }
  for (const p of dbPacks) {
    if (seen.has(p.id)) continue;
    out.push(p);
    seen.add(p.id);
  }
  return out;
}

export function filterMergedKnowledgePacks(
  packs: readonly KnowledgePack[],
  input: { readonly agent: KnowledgePackAgent | "ALL"; readonly category: KnowledgePackCategory | "ALL" }
): KnowledgePack[] {
  return packs.filter((p) => {
    if (input.agent !== "ALL" && !p.agents.includes(input.agent)) return false;
    if (input.category !== "ALL" && p.category !== input.category) return false;
    return true;
  });
}

export const DEFAULT_AGENT_CATEGORY_MAPPINGS = [
  { agentRole: "AI_DEVELOPER", category: "GRID", enabled: true, usageMode: "PROMPT_INJECTION", priority: 100 },
  { agentRole: "AI_REVIEWER", category: "GRID", enabled: true, usageMode: "REVIEW_CHECKLIST", priority: 90 },
  { agentRole: "AI_SECURITY", category: "GRID", enabled: true, usageMode: "SECURITY_GATE", priority: 90 },
  { agentRole: "AI_DESIGNER", category: "GRID", enabled: true, usageMode: "REFERENCE", priority: 80 },
] as const;
