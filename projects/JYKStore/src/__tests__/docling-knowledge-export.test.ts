import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  isDoclingKnowledgeExportStageId,
} from "../lib/docling-knowledge/docling-knowledge-export.ts";
import { DOCLING_KNOWLEDGE_STAGES } from "../lib/docling-knowledge/docling-knowledge-stages.ts";

describe("docling knowledge pipeline stage export", () => {
  it("accepts the five knowledge stage ids", () => {
    for (const stage of DOCLING_KNOWLEDGE_STAGES) {
      assert.equal(isDoclingKnowledgeExportStageId(stage.id), true);
    }
    assert.equal(isDoclingKnowledgeExportStageId("READY_FOR_REVIEW"), false);
    assert.equal(isDoclingKnowledgeExportStageId(""), false);
  });

  it("wires export route and download CTA", () => {
    const root = join(import.meta.dirname, "../..");
    const route = readFileSync(
      join(root, "src/app/api/v1/provider/packs/[packId]/knowledge-pipeline/export/route.ts"),
      "utf8",
    );
    const service = readFileSync(
      join(root, "src/lib/docling-knowledge/docling-knowledge-export.ts"),
      "utf8",
    );
    const ui = readFileSync(
      join(root, "src/components/provider-distribution/ProviderKnowledgeGenerationTab.tsx"),
      "utf8",
    );
    const api = readFileSync(join(root, "src/lib/provider-center-api.ts"), "utf8");
    assert.ok(route.includes("exportDoclingKnowledgePipelineStage"));
    assert.ok(route.includes("buildContentDisposition"));
    assert.ok(service.includes("sectionsJson"));
    assert.ok(service.includes("DOCLING_KNOWLEDGE_UNIT_CHUNK_TYPE"));
    assert.ok(service.includes("DOCLING_RETRIEVAL_CHUNK_TYPE"));
    assert.ok(service.includes("벡터 값(vector)은 용량이 커서 제외"));
    assert.ok(service.includes("evaluation"));
    assert.ok(api.includes("downloadProviderKnowledgePipelineStageApi"));
    assert.ok(ui.includes("데이터 다운로드"));
    assert.ok(ui.includes("downloadProviderKnowledgePipelineStageApi"));
  });
});
