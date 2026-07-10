import type {
  GeneratedRetrievalCase,
  ChunkForCaseGen,
  SourceDocForCaseGen,
  StructureSectionForCaseGen,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-types";
import {
  MAX_AUTO_RETRIEVAL_EVAL_CASES,
  RECOMMENDED_RETRIEVAL_EVAL_CASES,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-types";

const BANNED_QUERY_TOKENS = new Set([
  "api",
  "error",
  "product_manual",
  "product-manual",
  "openapi",
  "openapi_schema",
  "api_spec",
  "faq",
  "readme",
  "callback_guide",
  "error_code_table",
  "sample_code",
  "security_guide",
]);

function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

function isBannedQuery(query: string): boolean {
  const key = normalizeQuery(query);
  if (!key) return true;
  if (BANNED_QUERY_TOKENS.has(key)) return true;
  if (/^[a-z0-9_\-]+$/.test(key) && key.length <= 4) return true;
  return false;
}

/** Cases must map to a real active chunk or source document — sections/tags alone are not enough. */
function hasMappedEvidence(c: GeneratedRetrievalCase): boolean {
  return c.expectedChunkIds.length > 0 || c.expectedSourceDocumentIds.length > 0;
}

function pushUnique(
  out: GeneratedRetrievalCase[],
  seen: Set<string>,
  draft: GeneratedRetrievalCase,
) {
  const key = normalizeQuery(draft.query);
  if (!key || seen.has(key) || isBannedQuery(draft.query)) return;
  if (!hasMappedEvidence(draft)) return;
  seen.add(key);
  out.push(draft);
}

export function generateRetrievalEvaluationCases(input: {
  structureSections: StructureSectionForCaseGen[];
  sources: SourceDocForCaseGen[];
  chunks: ChunkForCaseGen[];
  maxCases?: number;
}): GeneratedRetrievalCase[] {
  const activeChunks = input.chunks.filter((c) => c.isActive && c.sourceDocumentId);
  const activeSourceIds = new Set(
    activeChunks.map((c) => c.sourceDocumentId!).filter(Boolean),
  );

  const maxByChunks = Math.max(activeChunks.length, Math.min(activeChunks.length * 2, 10));
  const max = Math.min(
    input.maxCases ?? RECOMMENDED_RETRIEVAL_EVAL_CASES,
    MAX_AUTO_RETRIEVAL_EVAL_CASES,
    Math.max(1, maxByChunks),
  );

  const out: GeneratedRetrievalCase[] = [];
  const seen = new Set<string>();

  // 1) Prefer cases derived from actual active chunks
  for (const chunk of activeChunks) {
    const titleQuery = chunk.title.trim();
    pushUnique(out, seen, {
      query: titleQuery,
      mode: "both",
      topK: 5,
      expectedChunkIds: [chunk.id],
      expectedSourceDocumentIds: chunk.sourceDocumentId ? [chunk.sourceDocumentId] : [],
      expectedSections: chunk.section ? [chunk.section] : [],
      expectedTags: chunk.tags.slice(0, 2),
      expectedMetadata: null,
      weight: 2,
    });
    if (out.length >= max) return out;

    if (chunk.section && normalizeQuery(chunk.section) !== normalizeQuery(titleQuery)) {
      pushUnique(out, seen, {
        query: `${titleQuery} ${chunk.section}`.trim(),
        mode: "both",
        topK: 5,
        expectedChunkIds: [chunk.id],
        expectedSourceDocumentIds: chunk.sourceDocumentId ? [chunk.sourceDocumentId] : [],
        expectedSections: [chunk.section],
        expectedTags: [],
        expectedMetadata: null,
        weight: 1,
      });
      if (out.length >= max) return out;
    }
  }

  // 2) Sources that currently have active chunks
  const eligibleSources = input.sources.filter(
    (s) =>
      (s.validationStatus === "PASS" || s.validationStatus === "WARNING") &&
      activeSourceIds.has(s.id),
  );

  for (const source of eligibleSources) {
    pushUnique(out, seen, {
      query: source.title,
      mode: "both",
      topK: 5,
      expectedChunkIds: [],
      expectedSourceDocumentIds: [source.id],
      expectedSections: [],
      expectedTags: [],
      expectedMetadata: null,
      weight: 1,
    });
    if (out.length >= max) return out;
  }

  // 3) Structure sections only when matched docs are covered by active chunks
  for (const section of input.structureSections) {
    if (!section.required || !section.covered) continue;
    const mappedDocs = section.matchedDocIds.filter((id) => activeSourceIds.has(id));
    if (mappedDocs.length === 0) continue;

    const signalQuery =
      section.matchedSignals
        .map((s) => (s.includes(":") ? s.split(":").slice(1).join(":") : s))
        .map((s) => s.trim())
        .find((s) => s && !isBannedQuery(s)) ?? section.title;

    pushUnique(out, seen, {
      query: signalQuery || section.title,
      mode: "both",
      topK: 5,
      expectedChunkIds: [],
      expectedSourceDocumentIds: mappedDocs,
      expectedSections: [section.sectionKey, section.title].filter(Boolean),
      expectedTags: [],
      expectedMetadata: null,
      weight: 2,
    });
    if (out.length >= max) return out;
  }

  return out;
}
