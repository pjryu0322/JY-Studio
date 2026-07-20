import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { mapSearchDataFailureCode } from "../lib/search-data/search-data-error.ts";
import {
  computeSearchDataUiState,
  type SearchDataStatusInput,
} from "../lib/search-data/search-data-state.ts";
import {
  provisionalEnqueueLocalE5Descriptor,
  searchDataStaleSeconds,
} from "../lib/search-data/search-data-generation-service.ts";

const root = join(process.cwd());

describe("forceRegenerate wiring", () => {
  const tab = readFileSync(
    join(root, "src/components/provider-distribution/ProviderServiceValidationTab.tsx"),
    "utf8",
  );
  const api = readFileSync(join(root, "src/lib/provider-center-api.ts"), "utf8");
  const generateRoute = readFileSync(
    join(root, "src/app/api/v1/provider/packs/[packId]/search-data/generate/route.ts"),
    "utf8",
  );
  const enqueue = [
    readFileSync(join(root, "src/lib/search-data/search-data-generation-enqueue.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-enqueue-tx.ts"), "utf8"),
    readFileSync(
      join(root, "src/lib/search-data/search-data-generation-enqueue-preflight.ts"),
      "utf8",
    ),
  ].join("\n");
  const worker = [
    readFileSync(join(root, "src/lib/search-data/search-data-generation-worker.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-process.ts"), "utf8"),
  ].join("\n");
  const service = [enqueue, worker].join("\n");

  it("UI sends forceRegenerate=true for regenerate CTAs", () => {
    assert.match(tab, /handleGenerate\(true\)/);
    assert.match(tab, /handleGenerate\(false\)/);
    assert.match(api, /forceRegenerate:\s*Boolean\(options\?\.forceRegenerate\)/);
    assert.match(generateRoute, /forceRegenerate\s*=\s*body\?\.forceRegenerate\s*===\s*true/);
  });

  it("service distinguishes force vs already_complete", () => {
    assert.match(service, /forceRegenerate/);
    assert.match(service, /already_complete/);
    assert.match(service, /SEARCH_DATA_GENERATION_FORCE_ENQUEUED/);
    assert.match(service, /provisionalEnqueueLocalE5Descriptor/);
    assert.match(service, /assertGenerationDescriptorMatchesRuntime/);
    assert.doesNotMatch(service, /embeddingModel:\s*descriptor\.embeddingModel/);
    assert.doesNotMatch(enqueue, /resolveSearchGenerationEmbeddingDescriptor/);
    assert.doesNotMatch(enqueue, /assertPgvectorRuntimeReady/);
  });

  it("recovers stale EMBEDDING inside a single transaction", () => {
    const recoverSlice = worker.slice(
      worker.indexOf("export async function recoverOneStaleSearchDataGeneration"),
      worker.indexOf("export async function claimNextSearchDataGeneration"),
    );
    assert.match(recoverSlice, /prisma\.\$transaction/);
    assert.match(recoverSlice, /FOR UPDATE SKIP LOCKED/);
    assert.match(recoverSlice, /DELETE FROM "SearchIndexVector"/);
    assert.match(recoverSlice, /status:\s*"PENDING"/);
  });
});

describe("binding stale UI mapping", () => {
  const e5Failed = {
    id: "g1",
    status: "FAILED",
    scope: "DRAFT",
    embeddingProvider: "local-e5",
    embeddingModel: "dragonkue/multilingual-e5-small-ko-v2",
    embeddingModelRevision: "fcfc26bf355882620c48df58be112275bd756f50",
    embeddingDimension: 384,
    chunkCount: 86,
    embeddedCount: 0,
    failedCount: 0,
    chunkGenerationId: "g1",
    pipelineRunId: "run1",
    normalizedDocumentId: "nd1",
    fingerprint: "fp1",
    attempt: 1,
    failureCode: "SEARCH_DATA_BINDING_STALE",
    failureMessage: "binding mismatch",
  };

  it("maps SEARCH_DATA_BINDING_STALE FAILED generation to STALE UI", () => {
    const input: SearchDataStatusInput = {
      structurePassed: true,
      pipelineCurrent: true,
      packStatusIsDraft: true,
      chunkCount: 86,
      generation: e5Failed,
      vectorCount: 0,
    };
    assert.equal(computeSearchDataUiState(input), "STALE");
  });

  it("maps recovery failure message", () => {
    const g = mapSearchDataFailureCode("SEARCH_DATA_RECOVERY_FAILED");
    assert.match(g.message, /복구하지 못했습니다/);
    assert.equal(g.supportRequired, true);
  });
});

describe("enqueue provisional descriptor + stale seconds", () => {
  it("builds local-e5 provisional without worker probe", () => {
    const d = provisionalEnqueueLocalE5Descriptor({
      JYKSTORE_EMBEDDING_PROVIDER: "local-e5",
      JYKSTORE_EMBEDDING_MODEL: "dragonkue/multilingual-e5-small-ko-v2",
      JYKSTORE_EMBEDDING_MODEL_REVISION: "fcfc26bf355882620c48df58be112275bd756f50",
      JYKSTORE_EMBEDDING_DIMENSION: "384",
    });
    assert.equal(d.embeddingProvider, "local-e5");
    assert.equal(d.embeddingDimension, 384);
    assert.equal(d.embeddingModelRevision.length, 40);
  });

  it("defaults stale seconds to 300", () => {
    assert.equal(searchDataStaleSeconds({}), 300);
    assert.equal(searchDataStaleSeconds({ JYKSTORE_SEARCH_DATA_STALE_SECONDS: "120" }), 120);
  });
});

describe("dev process includes search-data worker", () => {
  it("package.json dev script starts search-worker", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.match(pkg.scripts.dev, /dev:search-worker/);
    assert.match(pkg.scripts["dev:search-worker"], /search-data-generation-worker/);
  });
});
