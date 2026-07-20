import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(process.cwd());

describe("search-data async enqueue + failure UX", () => {
  const tab = readFileSync(
    join(root, "src/components/provider-distribution/ProviderServiceValidationTab.tsx"),
    "utf8",
  );
  const generateRoute = readFileSync(
    join(root, "src/app/api/v1/provider/packs/[packId]/search-data/generate/route.ts"),
    "utf8",
  );
  const service = [
    readFileSync(join(root, "src/lib/search-data/search-data-generation-service.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-types.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-policy.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-enqueue.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-enqueue-tx.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-enqueue-tx-policy.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-enqueue-tx-writes.ts"), "utf8"),
    readFileSync(
      join(root, "src/lib/search-data/search-data-generation-enqueue-preflight.ts"),
      "utf8",
    ),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-worker.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-worker-recover.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-process.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-process-embed.ts"), "utf8"),
    readFileSync(
      join(root, "src/lib/search-data/search-data-generation-process-preconditions.ts"),
      "utf8",
    ),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-evaluation.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-evaluation-writes.ts"), "utf8"),
    readFileSync(join(root, "src/lib/search-data/search-data-generation-evaluation-runner.ts"), "utf8"),
  ].join("\n");
  const pkg = readFileSync(join(root, "package.json"), "utf8");

  it("returns HTTP 202 for accepted generate enqueue", () => {
    assert.match(generateRoute, /status:\s*202/);
    assert.match(service, /accepted:\s*true/);
    assert.match(service, /claimNextSearchDataGeneration/);
    assert.match(service, /recoverOneStaleSearchDataGeneration/);
    assert.match(pkg, /worker:search-data/);
    assert.match(pkg, /dev:search-worker/);
  });

  it("does not mutate process.env for pgvector in generate path", () => {
    assert.doesNotMatch(service, /process\.env\.JYKSTORE_REQUIRE_PGVECTOR\s*=/);
    assert.match(service, /requirePgvector:\s*true/);
    assert.match(service, /provisionalEnqueueLocalE5Descriptor/);
  });

  it("does not failDraftIndexGeneration on quality evaluation FAIL", () => {
    assert.doesNotMatch(service, /import\s*\{[^}]*failDraftIndexGeneration/);
    assert.match(service, /Keep SearchIndexGeneration INDEXING/);
  });

  it("invalidates service validations inside enqueue transaction", () => {
    assert.match(service, /markServiceValidationsStaleForVersion/);
  });

  it("CREATE_FAILED shows one card message and hides API·MCP lock on failure", () => {
    assert.match(tab, /검색데이터 생성 실패/);
    assert.match(
      tab,
      /sd\?\.state === "CREATED"[\s\S]*VALIDATING[\s\S]*VALIDATION_FAILED/,
    );
    assert.match(tab, /관리자에게 문의가 필요합니다/);
    // Global alert must not repeat card CREATE_FAILED copy path for successful status.
    assert.match(tab, /검색데이터 요청에 실패했습니다/);
  });

  it("VALIDATION_FAILED uses quality copy not create-failure", () => {
    assert.match(tab, /검색 품질 보완 필요/);
    assert.doesNotMatch(
      tab,
      /VALIDATION_FAILED[\s\S]{0,200}검색데이터 생성 실패/,
    );
  });

  it("cleanup deletes do not swallow errors with empty catch", () => {
    assert.doesNotMatch(
      service,
      /DELETE FROM "SearchIndexVector"[\s\S]{0,80}\.catch\(\(\) => undefined\)/,
    );
  });
});
