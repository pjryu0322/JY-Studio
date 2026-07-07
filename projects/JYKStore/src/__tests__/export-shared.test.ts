import { test } from "node:test";
import assert from "node:assert/strict";

// export-shared는 @/lib/prisma를 import하므로 DB 접근 없는 순수 함수 테스트를 위해
// dummy DATABASE_URL만 세팅하고, prisma 생성 시점을 늦추기 위해 dynamic import를 사용한다.
// (loadPublicKnowledgePack/loadLatestPackVersion은 테스트하지 않는다)
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";

let modPromise: Promise<typeof import("@/lib/exports/export-shared")> | null = null;
function loadExportShared() {
  return (modPromise ??= import("@/lib/exports/export-shared"));
}

test("sanitizeExportMetadata returns allowed canonical metadata", async () => {
  const { sanitizeExportMetadata } = await loadExportShared();
  assert.deepEqual(
    sanitizeExportMetadata({ documentType: "SAMPLE_CODE", programmingLanguage: "Java" }),
    { documentType: "SAMPLE_CODE", programmingLanguage: "Java" },
  );
});

test("sanitizeExportMetadata drops sensitive-key metadata (returns null)", async () => {
  const { sanitizeExportMetadata } = await loadExportShared();
  assert.equal(sanitizeExportMetadata({ apiKey: "secret" }), null);
});

test("sanitizeExportMetadata returns null for invalid metadata", async () => {
  const { sanitizeExportMetadata } = await loadExportShared();
  assert.equal(sanitizeExportMetadata(["not", "an", "object"]), null);
  assert.equal(sanitizeExportMetadata("string"), null);
});

test("sanitizeExportMetadata returns null for empty/null metadata", async () => {
  const { sanitizeExportMetadata } = await loadExportShared();
  assert.equal(sanitizeExportMetadata({}), null);
  assert.equal(sanitizeExportMetadata(null), null);
});

test("buildExportGeneratedAt returns a valid ISO timestamp", async () => {
  const { buildExportGeneratedAt } = await loadExportShared();
  const value = buildExportGeneratedAt();
  assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(new Date(value).toISOString(), value);
});
