/**
 * Deeper P4.3 chunk quality probes on Worker output.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const outDir = process.argv[2] || "tmp-p4-3-validation/worker-out";
const chunks = JSON.parse(readFileSync(path.join(outDir, "chunks.json"), "utf8")) as Array<
  Record<string, unknown>
>;
const inventory = JSON.parse(
  readFileSync(path.join(outDir, "inventory.json"), "utf8"),
) as Array<Record<string, unknown>>;
const report = JSON.parse(
  readFileSync(path.join(outDir, "validation_report.json"), "utf8"),
) as Record<string, unknown>;
const docs = JSON.parse(
  readFileSync(path.join(outDir, "normalized_documents.json"), "utf8"),
) as Array<Record<string, unknown>>;

function approxTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

const mergeReasons: Record<string, number> = {};
const autoTypes: Record<string, number> = {};
let provenanceWc = 0;
let provenanceRev = 0;
let provenanceInv = 0;
const contentHash = new Map<string, number>();
const shortMeaningfulCandidates: Array<Record<string, unknown>> = [];
const undersizedMergedSamples: Array<Record<string, unknown>> = [];
const overHardSamples: Array<Record<string, unknown>> = [];

const apiSigRe =
  /^(?:\s*(?:GET|POST|PUT|PATCH|DELETE)\s+\/|\s*(?:function|class|interface|enum|const|let|var)\s+\w)/im;
const errRe = /^\s*(?:error|err|errno|status|code)\s*[:=#]/im;

for (const c of chunks) {
  const content = String(c.content ?? "");
  const tokens = approxTokens(content);
  const key = content.replace(/\s+/g, " ").trim().toLowerCase();
  if (key.length > 20) contentHash.set(key, (contentHash.get(key) ?? 0) + 1);

  if (c.workingCopyId) provenanceWc += 1;
  if (c.sourceRevisionId) provenanceRev += 1;
  if (c.inventoryItemId) provenanceInv += 1;

  const reason = typeof c.mergeReason === "string" ? c.mergeReason : null;
  if (reason) mergeReasons[reason] = (mergeReasons[reason] ?? 0) + 1;

  const autos = Array.isArray(c.autoCorrections) ? c.autoCorrections : [];
  for (const a of autos) {
    const t = String((a as { autoCorrectionType?: string }).autoCorrectionType ?? "unknown");
    autoTypes[t] = (autoTypes[t] ?? 0) + 1;
  }

  if (reason === "undersized_fragment_merged" && undersizedMergedSamples.length < 15) {
    undersizedMergedSamples.push({
      chunkId: c.chunkId,
      sourcePath: c.sourcePath,
      section: c.section,
      tokens,
      mergeReason: reason,
      autoCorrections: autos,
      preview: content.slice(0, 180),
    });
  }

  if (tokens > 512) {
    overHardSamples.push({
      chunkId: c.chunkId,
      sourcePath: c.sourcePath,
      tokens,
      preview: content.slice(0, 120),
    });
  }

  if (tokens > 0 && tokens < 80 && (apiSigRe.test(content) || errRe.test(content) || Array.isArray(c.codeBlocks) && (c.codeBlocks as unknown[]).length > 0)) {
    if (shortMeaningfulCandidates.length < 20) {
      shortMeaningfulCandidates.push({
        chunkId: c.chunkId,
        sourcePath: c.sourcePath,
        section: c.section,
        tokens,
        mergeReason: reason,
        preview: content.slice(0, 160),
      });
    }
  }
}

const exactDupGroups = [...contentHash.entries()].filter(([, n]) => n > 1);
const exactDupChunks = exactDupGroups.reduce((s, [, n]) => s + n, 0);

const knowledge = inventory.filter((e) => e.classification === "knowledge_target");
const excluded = inventory.filter((e) => e.classification === "excluded");
const review = inventory.filter((e) => e.classification === "review_target");

const byParser: Record<string, number> = {};
for (const e of knowledge) {
  const p = String(e.parser ?? "none");
  byParser[p] = (byParser[p] ?? 0) + 1;
}

const docsByType: Record<string, number> = {};
for (const d of docs) {
  const t = String(d.sourceType ?? "unknown");
  docsByType[t] = (docsByType[t] ?? 0) + 1;
}

// Traceability sample: pick 3 chunks and resolve via inventory sourcePath
const sampleTrace = chunks.slice(0, 3).map((c) => {
  const sp = String(c.sourcePath ?? "");
  const inv = inventory.find((e) => e.sourcePath === sp);
  return {
    chunkId: c.chunkId,
    sourcePath: sp,
    section: c.section,
    workingCopyId: c.workingCopyId ?? null,
    sourceRevisionId: c.sourceRevisionId ?? null,
    inventoryItemId: c.inventoryItemId ?? null,
    inventorySha256: inv?.sha256 ?? null,
    inventoryClassification: inv?.classification ?? null,
    inventoryParser: inv?.parser ?? null,
    canLocateInArchive: Boolean(inv),
  };
});

const result = {
  inventory: {
    total: inventory.length,
    knowledge_target: knowledge.length,
    excluded: excluded.length,
    review_target: review.length,
    knowledgeByParser: byParser,
  },
  documents: { total: docs.length, bySourceType: docsByType },
  chunks: {
    total: chunks.length,
    mergeReasons,
    autoCorrectionTypes: autoTypes,
    exactDuplicateGroups: exactDupGroups.length,
    exactDuplicateChunkOccurrences: exactDupChunks,
    remainingExactDupTop: exactDupGroups
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([preview, n]) => ({ n, preview: preview.slice(0, 100) })),
  },
  provenance: {
    withWorkingCopyId: provenanceWc,
    withSourceRevisionId: provenanceRev,
    withInventoryItemId: provenanceInv,
    sampleTrace,
  },
  shortMeaningfulProtectedSamples: shortMeaningfulCandidates,
  undersizedMergedSamples,
  overHardMax512Samples: overHardSamples,
  validationReport: {
    status: report.status,
    warnings: report.warnings,
    errors: report.errors,
    counts: report.counts ?? report.summary ?? null,
    excludedFiles: Array.isArray(report.excludedFiles) ? report.excludedFiles.length : null,
  },
};

const dest = path.join(process.cwd(), "tmp-p4-3-validation");
mkdirSync(dest, { recursive: true });
writeFileSync(path.join(dest, "worker-deep-probe.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
