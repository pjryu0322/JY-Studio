import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { BINDING_FAILURE_USER_MESSAGE } from "../lib/docling-knowledge/docling-knowledge-pipeline-status-policy.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function readPipelineModules(): string {
  return [
    "docling-knowledge-pipeline-execute.ts",
    "docling-knowledge-pipeline-runner-structure.ts",
    "docling-knowledge-pipeline-runner-knowledge.ts",
    "docling-knowledge-pipeline-runner-chunk.ts",
    "docling-knowledge-pipeline-failure.ts",
    "docling-knowledge-pipeline-service.ts",
  ]
    .map((f) => readFileSync(join(root, "src/lib/docling-knowledge", f), "utf8"))
    .join("\n");
}

describe("docling knowledge pipeline execute split", () => {
  it("keeps STRUCTURE → KU → CHUNK → finalize order in orchestration", () => {
    const execute = readFileSync(
      join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-execute.ts"),
      "utf8",
    );
    const bodyStart = execute.indexOf("export async function executeDoclingKnowledgePipeline");
    const body = execute.slice(bodyStart);
    const structureIdx = body.indexOf("runStructureStage");
    const knowledgeIdx = body.indexOf("runKnowledgeUnitStage");
    const chunkIdx = body.indexOf("runRetrievalChunkStage");
    const finalizeIdx = body.indexOf("finalizeStructurePipelinePass");
    assert.ok(structureIdx > 0 && knowledgeIdx > structureIdx);
    assert.ok(chunkIdx > knowledgeIdx && finalizeIdx > chunkIdx);
    assert.ok(!body.includes("evaluateNormalizedDocumentStructureQuality"));
    assert.ok(!body.includes("buildKnowledgeFromNormalizedDocument"));
  });

  it("maps binding failures to provider refresh guidance", () => {
    assert.match(BINDING_FAILURE_USER_MESSAGE, /새로고침/);
    const modules = readPipelineModules();
    assert.ok(modules.includes("failBindingMismatch"));
    assert.ok(modules.includes("DOCLING_BUNDLE_MISMATCH"));
    assert.ok(modules.includes("FINGERPRINT_MISMATCH"));
  });

  it("facade re-exports execute without embedding status policy logic", () => {
    const service = readFileSync(
      join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-service.ts"),
      "utf8",
    );
    assert.ok(service.includes('from "@/lib/docling-knowledge/docling-knowledge-pipeline-execute"'));
    assert.ok(service.includes('from "@/lib/docling-knowledge/docling-knowledge-pipeline-status"'));
    assert.ok(!service.includes("resolveDoclingKnowledgePrimaryCta"));
    assert.ok(!service.includes("STRUCTURE_VALIDATING"));
  });
});
