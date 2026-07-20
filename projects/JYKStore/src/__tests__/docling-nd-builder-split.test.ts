import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  MAX_RESPLIT_DEPTH,
  reserveSplitSuffixTokens,
} from "../lib/docling-knowledge/docling-nd-token-split-policy.ts";
import { validateChunkProvenanceBeforeSave } from "../lib/docling-knowledge/docling-nd-chunk-provenance.ts";

const root = join(process.cwd());
const dir = join(root, "src/lib/docling-knowledge");

describe("Docling ND builder Phase 6 split contracts", () => {
  it("keeps public facade exports", () => {
    const facade = readFileSync(join(dir, "docling-nd-knowledge-builder.ts"), "utf8");
    for (const name of [
      "buildKnowledgeFromNormalizedDocument",
      "activateDraftIndexGeneration",
      "failDraftIndexGeneration",
      "promoteDraftIndexToProduction",
      "ensureDoclingOriginSourceDocument",
      "reserveSplitSuffixTokens",
      "splitSectionIntoUnitTexts",
      "extractFullTableRows",
      "stableGenerationSeed",
    ]) {
      assert.match(facade, new RegExp(name));
    }
  });

  it("preserves multi-digit title suffix token budget", () => {
    const budgeted = reserveSplitSuffixTokens("제목", { maxDigits: 4 });
    assert.match(budgeted, /\(9999\)$/);
    assert.equal(MAX_RESPLIT_DEPTH, 2);
  });

  it("rejects resplitDepth above MAX_RESPLIT_DEPTH", () => {
    const result = validateChunkProvenanceBeforeSave(
      [
        {
          title: "t",
          content: "c",
          metadata: {
            tokenCount: 10,
            primarySourceTextStart: 0,
            primarySourceTextEnd: 1,
            resplitDepth: MAX_RESPLIT_DEPTH + 1,
          },
        },
      ],
      512,
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "CHUNK_TOKEN_RESPLIT_EXHAUSTED");
    }
  });

  it("keeps primaryContent / absolutePrimaryStart / validateChunkProvenance in split modules", () => {
    const retrieval = readFileSync(join(dir, "docling-nd-retrieval-chunk-builder.ts"), "utf8");
    const provenance = readFileSync(join(dir, "docling-nd-chunk-provenance.ts"), "utf8");
    assert.match(retrieval, /primaryContent/);
    assert.match(retrieval, /sourceTextStart:\s*absolutePrimaryStart/);
    assert.match(retrieval, /validateChunkProvenanceBeforeSave/);
    assert.match(retrieval, /CHUNK_TOKEN_RESPLIT_EXHAUSTED/);
    assert.match(retrieval, /splitTableRowsByTokens/);
    assert.match(provenance, /export function validateChunkProvenanceBeforeSave/);
  });

  it("avoids circular imports among docling-nd-* modules", () => {
    const files = readdirSync(dir).filter((f) => f.startsWith("docling-nd-") && f.endsWith(".ts"));
    const importRe = /from\s+["']@\/lib\/docling-knowledge\/(docling-nd-[a-z0-9-]+)["']/g;
    const graph = new Map<string, string[]>();
    for (const file of files) {
      const src = readFileSync(join(dir, file), "utf8");
      const deps: string[] = [];
      for (const match of src.matchAll(importRe)) {
        deps.push(`${match[1]}.ts`);
      }
      graph.set(file, deps);
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(node: string, stack: string[]) {
      if (visiting.has(node)) {
        assert.fail(`circular import: ${[...stack, node].join(" -> ")}`);
      }
      if (visited.has(node)) return;
      visiting.add(node);
      for (const dep of graph.get(node) ?? []) {
        if (graph.has(dep)) visit(dep, [...stack, node]);
      }
      visiting.delete(node);
      visited.add(node);
    }
    for (const file of files) visit(file, []);
  });
});
