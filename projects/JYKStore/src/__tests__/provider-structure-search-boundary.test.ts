import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  filterStagesByIds,
  SEARCH_FOUNDATION_STAGE_IDS,
  STRUCTURE_STAGE_IDS,
} from "../lib/docling-knowledge/docling-knowledge-stage-pass.ts";
import { DOCLING_KNOWLEDGE_STAGES } from "../lib/docling-knowledge/docling-knowledge-stages.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..", "..");

function readSource(relativePath: string): string {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

describe("structure vs search validation UI boundaries", () => {
  it("filters pipeline stages into structure and search-foundation sets", () => {
    const structure = filterStagesByIds(DOCLING_KNOWLEDGE_STAGES, STRUCTURE_STAGE_IDS);
    const search = filterStagesByIds(DOCLING_KNOWLEDGE_STAGES, SEARCH_FOUNDATION_STAGE_IDS);
    assert.deepEqual(
      structure.map((s) => s.id),
      ["STRUCTURE", "KNOWLEDGE_UNIT", "RETRIEVAL_CHUNK"],
    );
    assert.deepEqual(
      search.map((s) => s.id),
      ["SEARCH_INDEX", "RETRIEVAL_EVALUATION"],
    );
  });

  it("knowledge tab renders only structure stages", () => {
    const src = readSource(
      "src/components/provider-distribution/ProviderKnowledgeGenerationTab.tsx",
    );
    assert.ok(src.includes("STRUCTURE_STAGE_IDS"));
    assert.ok(src.includes("filterStagesByIds"));
    assert.ok(src.includes("onGoToSearchValidation"));
    assert.ok(!src.includes("SEARCH_FOUNDATION_STAGE_IDS"));
  });

  it("search validation tab shows foundation stages and channel cards", () => {
    const src = readSource(
      "src/components/provider-distribution/ProviderServiceValidationTab.tsx",
    );
    assert.ok(src.includes("SEARCH_FOUNDATION_STAGE_IDS"));
    assert.ok(src.includes("API"));
    assert.ok(src.includes("MCP"));
    assert.ok(src.includes("DOWNLOAD"));
    assert.ok(src.includes("onGoToDistributionReview"));
    assert.ok(src.includes("local-hash"));
    assert.ok(src.includes("RAG Export"));
    assert.ok(src.includes("DOWNLOAD PASS는 RAG Export PASS가 아닙니다"));
  });

  it("does not market local-hash as production embedding", () => {
    const stages = readSource("src/lib/docling-knowledge/docling-knowledge-stages.ts");
    assert.ok(stages.includes("운영용 Embedding은 아직 적용되지 않습니다"));
    assert.ok(!stages.includes("운영용 Vector Index 구축 완료"));
    assert.ok(!stages.includes("pgvector 적용 완료"));
  });

  it("keeps URL aliases for renamed tabs", () => {
    const tabs = readSource("src/lib/provider-pack-tabs.ts");
    assert.ok(tabs.includes('"data-structure": "knowledge"'));
    assert.ok(tabs.includes('"search-validation": "serviceValidation"'));
    assert.ok(tabs.includes('distribution: "distributionReview"'));
    assert.ok(tabs.includes('review: "distributionReview"'));
  });

  it("tab status badges include completion and lock text", () => {
    const tabs = readSource("src/components/ProviderPackTabs.tsx");
    assert.ok(tabs.includes("stepStatuses"));
    assert.ok(tabs.includes("statusLabel"));
    assert.ok(tabs.includes("잠김"));
  });
});
