import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(process.cwd());
const searchDataDir = join(root, "src/lib/search-data");

function readModule(name: string): string {
  return readFileSync(join(searchDataDir, name), "utf8");
}

describe("search-data generation orchestration Phase B split", () => {
  const facade = readModule("search-data-generation-service.ts");
  const worker = readModule("search-data-generation-worker.ts");
  const execute = readFileSync(
    join(root, "src/lib/docling-knowledge/docling-knowledge-pipeline-execute.ts"),
    "utf8",
  );

  it("facade re-exports public orchestration API", () => {
    assert.match(facade, /provisionalEnqueueLocalE5Descriptor/);
    assert.match(facade, /searchDataStaleSeconds/);
    assert.match(facade, /SearchDataGenerateAccepted/);
    assert.match(facade, /getSearchDataStatus/);
    assert.match(facade, /startSearchDataGeneration/);
    assert.match(facade, /ClaimedSearchDataGeneration/);
    assert.match(facade, /recoverOneStaleSearchDataGeneration/);
    assert.match(facade, /claimNextSearchDataGeneration/);
    assert.match(facade, /processSearchDataGenerationJob/);
    assert.match(facade, /validateSearchData/);
    assert.match(facade, /__testOnlyIsLocalE5Generation/);
    assert.match(
      facade,
      /from ["']@\/lib\/search-data\/search-data-generation-policy["']/,
    );
    assert.match(
      facade,
      /from ["']@\/lib\/search-data\/search-data-generation-status["']/,
    );
    assert.match(
      facade,
      /from ["']@\/lib\/search-data\/search-data-generation-enqueue["']/,
    );
    assert.match(
      facade,
      /from ["']@\/lib\/search-data\/search-data-generation-worker["']/,
    );
    assert.match(
      facade,
      /from ["']@\/lib\/search-data\/search-data-generation-evaluation["']/,
    );
  });

  it("claim policy still gates on attempt > 0 in worker module", () => {
    const claimSlice = worker.slice(
      worker.indexOf("export async function claimNextSearchDataGeneration"),
      worker.indexOf("export async function processSearchDataGenerationJob"),
    );
    assert.match(claimSlice, /j\.attempt > 0/);
  });

  it("start/process stay thin orchestration wrappers", () => {
    const enqueue = readModule("search-data-generation-enqueue.ts");
    const processHelper = readModule("search-data-generation-process.ts");
    const processEmbed = readModule("search-data-generation-process-embed.ts");
    assert.match(enqueue, /assertSearchDataEnqueuePreflight/);
    assert.match(enqueue, /runSearchDataEnqueueTransaction/);
    assert.match(worker, /assertProcessJobPreconditions/);
    assert.match(worker, /runSearchDataEmbeddingAndIndex/);
    assert.match(worker, /failSearchDataProcessJob/);
    assert.match(processHelper, /assertClaimReadyForEmbedding/);
    // P7.6: TS doc/chunk embedding generation removed — legacy embed step is
    // fail-closed (Python Worker owns embeddings.json), never re-embeds in TS.
    assert.doesNotMatch(processEmbed, /rebuildPackEmbeddings/);
    assert.match(processEmbed, /LEGACY_BUILDER_DISABLED/);
  });

  it("docling-knowledge-pipeline-execute does not import search-data embed/eval/activate", () => {
    assert.doesNotMatch(execute, /rebuildPackEmbeddings/);
    assert.doesNotMatch(execute, /activateDraftIndexGeneration/);
    assert.doesNotMatch(execute, /runDoclingRetrievalEvaluation/);
  });
});
