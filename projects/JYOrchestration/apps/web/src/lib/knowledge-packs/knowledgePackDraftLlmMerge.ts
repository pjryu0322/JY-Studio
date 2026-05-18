import type { KnowledgePackDraftResult } from "@/lib/knowledge-packs/knowledgePackDraftGenerator";

const DRAFT_TEXT_FIELDS = [
  "summary",
  "licenseNotes",
  "recommendedUseCases",
  "notRecommendedUseCases",
  "capabilities",
  "constraints",
  "implementationGuidelines",
  "cursorPromptRules",
  "forbiddenPatterns",
  "reviewChecklist",
  "securityChecklist",
  "alternatives",
  "references",
  "previewSpec",
  "sourceCandidates",
] as const satisfies readonly (keyof Omit<KnowledgePackDraftResult, "warnings">)[];

function stripJsonFences(raw: string): string {
  let t = raw.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

function pickString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s.length ? s : undefined;
}

function normalizeWarningsField(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = pickString(v);
  return s ? s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
}

export function parseKnowledgePackDraftLlmJson(
  raw: string
): { ok: true; partial: Record<string, unknown> } | { ok: false; error: string } {
  const text = stripJsonFences(raw);
  if (!text) return { ok: false, error: "빈 응답" };
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    if (!j || typeof j !== "object" || Array.isArray(j)) {
      return { ok: false, error: "JSON이 객체가 아님" };
    }
    return { ok: true, partial: j };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `JSON 파싱 실패: ${msg.slice(0, 200)}` };
  }
}

export function mergeKnowledgePackDraftWithMock(
  mock: KnowledgePackDraftResult,
  partial: Record<string, unknown>
): KnowledgePackDraftResult {
  const next: Record<string, unknown> = { ...mock };
  for (const k of DRAFT_TEXT_FIELDS) {
    const picked = pickString(partial[k]);
    if (picked) next[k] = picked;
  }
  const extra = normalizeWarningsField(partial.warnings);
  const mergedWarnings = [...mock.warnings];
  for (const w of extra) {
    if (!mergedWarnings.includes(w)) mergedWarnings.push(w);
  }
  next.warnings = mergedWarnings;
  return next as KnowledgePackDraftResult;
}
