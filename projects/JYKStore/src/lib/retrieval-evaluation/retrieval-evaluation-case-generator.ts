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

const PRIORITY_SOURCE_TYPES = new Set([
  "API_SPEC",
  "OPENAPI_SCHEMA",
  "ERROR_CODE_TABLE",
  "CALLBACK_GUIDE",
  "SAMPLE_CODE",
  "SECURITY_GUIDE",
]);

function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasEvidence(c: GeneratedRetrievalCase): boolean {
  return (
    c.expectedChunkIds.length > 0 ||
    c.expectedSourceDocumentIds.length > 0 ||
    c.expectedSections.length > 0 ||
    c.expectedTags.length > 0 ||
    (c.expectedMetadata !== null && Object.keys(c.expectedMetadata).length > 0)
  );
}

function pushUnique(
  out: GeneratedRetrievalCase[],
  seen: Set<string>,
  draft: GeneratedRetrievalCase,
) {
  const key = normalizeQuery(draft.query);
  if (!key || seen.has(key)) return;
  if (!hasEvidence(draft)) return;
  seen.add(key);
  out.push(draft);
}

export function generateRetrievalEvaluationCases(input: {
  structureSections: StructureSectionForCaseGen[];
  sources: SourceDocForCaseGen[];
  chunks: ChunkForCaseGen[];
  maxCases?: number;
}): GeneratedRetrievalCase[] {
  const max = Math.min(
    input.maxCases ?? RECOMMENDED_RETRIEVAL_EVAL_CASES,
    MAX_AUTO_RETRIEVAL_EVAL_CASES,
  );
  const out: GeneratedRetrievalCase[] = [];
  const seen = new Set<string>();

  for (const section of input.structureSections) {
    if (!section.required || !section.covered) continue;
    const signalQuery =
      section.matchedSignals
        .map((s) => (s.includes(":") ? s.split(":").slice(1).join(":") : s))
        .filter(Boolean)[0] ?? section.title;
    pushUnique(out, seen, {
      query: signalQuery || section.title,
      mode: "both",
      topK: 5,
      expectedChunkIds: [],
      expectedSourceDocumentIds: [...section.matchedDocIds],
      expectedSections: [section.sectionKey, section.title].filter(Boolean),
      expectedTags: [],
      expectedMetadata: null,
      weight: 2,
    });
    if (out.length >= max) return out;
  }

  const eligibleSources = input.sources
    .filter((s) => s.validationStatus === "PASS" || s.validationStatus === "WARNING")
    .sort((a, b) => {
      const ap = PRIORITY_SOURCE_TYPES.has(a.sourceType) ? 0 : 1;
      const bp = PRIORITY_SOURCE_TYPES.has(b.sourceType) ? 0 : 1;
      return ap - bp;
    });

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
      weight: PRIORITY_SOURCE_TYPES.has(source.sourceType) ? 2 : 1,
    });
    if (out.length >= max) return out;
  }

  const activeChunks = input.chunks
    .filter((c) => c.isActive)
    .sort((a, b) => {
      const ap = a.sourceType && PRIORITY_SOURCE_TYPES.has(a.sourceType) ? 0 : 1;
      const bp = b.sourceType && PRIORITY_SOURCE_TYPES.has(b.sourceType) ? 0 : 1;
      return ap - bp;
    });

  for (const chunk of activeChunks) {
    const tags = chunk.tags.slice(0, 2);
    const queryParts = [chunk.title, ...tags].filter(Boolean);
    pushUnique(out, seen, {
      query: queryParts.join(" "),
      mode: "both",
      topK: 5,
      expectedChunkIds: [chunk.id],
      expectedSourceDocumentIds: chunk.sourceDocumentId ? [chunk.sourceDocumentId] : [],
      expectedSections: chunk.section ? [chunk.section] : [],
      expectedTags: tags,
      expectedMetadata: null,
      weight: 1,
    });
    if (out.length >= max) return out;
  }

  return out;
}
