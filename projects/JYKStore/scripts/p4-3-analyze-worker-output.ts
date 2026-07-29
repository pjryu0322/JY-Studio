/**
 * P4.3 — Analyze Worker output dir (chunks, traces, validation_report, inventory).
 * Usage: node --import tsx scripts/p4-3-analyze-worker-output.ts <outputDir>
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

function loadJson(p: string): unknown {
  return JSON.parse(readFileSync(p, "utf8"));
}

function approxTokens(text: string): number {
  // rough chars/4 heuristic aligned with Worker estimate
  return Math.ceil((text || "").length / 4);
}

function main() {
  const outDir = process.argv[2];
  if (!outDir || !existsSync(outDir)) {
    console.error("Usage: p4-3-analyze-worker-output.ts <outputDir>");
    process.exit(1);
  }
  const inventory = loadJson(path.join(outDir, "inventory.json")) as Array<Record<string, unknown>>;
  const chunks = loadJson(path.join(outDir, "chunks.json")) as Array<Record<string, unknown>>;
  const traces = loadJson(path.join(outDir, "source_trace.json")) as Array<Record<string, unknown>>;
  const report = loadJson(path.join(outDir, "validation_report.json")) as Record<string, unknown>;
  const docs = loadJson(path.join(outDir, "normalized_documents.json")) as Array<Record<string, unknown>>;
  let embeddings: Array<Record<string, unknown>> = [];
  try {
    embeddings = loadJson(path.join(outDir, "embeddings.json")) as Array<Record<string, unknown>>;
  } catch {
    embeddings = [];
  }

  const classCounts: Record<string, number> = {};
  const parserCounts: Record<string, number> = {};
  for (const e of inventory) {
    const c = String(e.classification ?? "unknown");
    classCounts[c] = (classCounts[c] ?? 0) + 1;
    const p = String(e.parser ?? "none");
    parserCounts[p] = (parserCounts[p] ?? 0) + 1;
  }

  const sizes = chunks.map((c) => approxTokens(String(c.content ?? "")));
  const hardMax = 512;
  const target = 480;
  const overHard = sizes.filter((n) => n > hardMax).length;
  const overTarget = sizes.filter((n) => n > target).length;
  const tooSmall = sizes.filter((n) => n > 0 && n < 48).length;
  const autoMerges = chunks.filter((c) => {
    const ac = c.autoCorrections;
    return Array.isArray(ac) && ac.length > 0;
  }).length;
  const undersizedMerges = chunks.filter((c) => c.mergeReason === "undersized_fragment_merged").length;
  const headingMerges = chunks.filter(
    (c) => typeof c.mergeReason === "string" && String(c.mergeReason).includes("heading"),
  ).length;
  const withInv = chunks.filter((c) => typeof c.inventoryItemId === "string" && c.inventoryItemId).length;
  const withWc = chunks.filter((c) => typeof c.workingCopyId === "string" && c.workingCopyId).length;
  const withRev = chunks.filter((c) => typeof c.sourceRevisionId === "string" && c.sourceRevisionId).length;

  const excludedFiles = (report.excludedFiles as unknown[]) || [];
  const warnings = (report.warnings as unknown[]) || [];
  const errors = (report.errors as unknown[]) || [];

  // structure sample issues
  let emptyBodySections = 0;
  let isolatedHeadings = 0;
  for (const doc of docs) {
    const sections = (doc.sections as Array<Record<string, unknown>>) || [];
    for (const s of sections) {
      const body = String(s.content ?? "").trim();
      const heading = String(s.heading ?? "").trim();
      const codes = (s.codeBlocks as unknown[]) || [];
      if (!body && codes.length === 0) emptyBodySections += 1;
      if (heading && !body && codes.length === 0) isolatedHeadings += 1;
    }
  }

  const summary = {
    inventoryFiles: inventory.length,
    classificationCounts: classCounts,
    parserCounts,
    documents: docs.length,
    chunks: chunks.length,
    embeddings: embeddings.length,
    traces: traces.length,
    chunkTokens: {
      avg: sizes.length ? Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length) : 0,
      min: sizes.length ? Math.min(...sizes) : 0,
      max: sizes.length ? Math.max(...sizes) : 0,
      overTarget480: overTarget,
      overHardMax512: overHard,
      tooSmallLt48: tooSmall,
    },
    autoCorrections: {
      chunksWithAutoCorrections: autoMerges,
      undersizedFragmentMerged: undersizedMerges,
      headingMergeReason: headingMerges,
    },
    provenance: {
      chunksWithInventoryItemId: withInv,
      chunksWithWorkingCopyId: withWc,
      chunksWithSourceRevisionId: withRev,
      note: "CLI-only run without Store options will have 0 provenance stamps",
    },
    structureSample: { emptyBodySections, isolatedHeadings },
    validationReport: {
      status: report.status,
      warnings: warnings.length,
      errors: errors.length,
      excludedFiles: excludedFiles.length,
      warningSamples: warnings.slice(0, 20),
      errorSamples: errors.slice(0, 20),
    },
    sampleChunks: chunks.slice(0, 5).map((c) => ({
      chunkId: c.chunkId,
      sourcePath: c.sourcePath,
      section: c.section,
      tokensApprox: approxTokens(String(c.content ?? "")),
      inventoryItemId: c.inventoryItemId ?? null,
      mergeReason: c.mergeReason ?? null,
      autoCorrections: c.autoCorrections ?? [],
    })),
  };

  const dest = path.join(process.cwd(), "tmp-p4-3-validation");
  mkdirSync(dest, { recursive: true });
  writeFileSync(path.join(dest, "worker-output-summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main();
