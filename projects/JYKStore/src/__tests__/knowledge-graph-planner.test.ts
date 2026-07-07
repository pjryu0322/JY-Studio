import { test } from "node:test";
import assert from "node:assert/strict";
import { planKnowledgeGraph } from "@/lib/knowledge-graph/graph-planner";
import type { RebuildVersion } from "@/lib/knowledge-graph/graph-types";

function makeVersion(overrides: Partial<{
  id: string;
  version: string;
  sourceDocuments: Array<{ id: string; title: string }>;
  chunks: Array<{
    id: string;
    title: string;
    content: string;
    sourceDocumentId: string | null;
    tags: string[];
    metadata: Record<string, unknown> | null;
  }>;
}> = {}): RebuildVersion {
  return {
    id: "ver-1",
    version: "1.0.0",
    sourceDocuments: [{ id: "doc-1", title: "간편인증 연동 가이드" }],
    chunks: [
      {
        id: "chunk-1",
        title: "Callback 처리",
        content: "인증 결과 callback 처리와 오류코드 대응 예시",
        sourceDocumentId: "doc-1",
        tags: ["callback", "java"],
        metadata: { documentType: "SAMPLE_CODE", programmingLanguage: "Java", securityLevel: "PUBLIC" },
      },
    ],
    ...overrides,
  } as unknown as RebuildVersion;
}

const edgeTypes = (edges: { edgeType: string }[]) => new Set(edges.map((e) => e.edgeType));
const nodeTypesOf = (map: Map<string, { nodeType: string }>) =>
  Array.from(map.values()).map((n) => n.nodeType);

test("planKnowledgeGraph returns empty plan when version is null", () => {
  const plan = planKnowledgeGraph({ packId: "easy-auth", packName: "Easy Auth", version: null });
  assert.equal(plan.nodesByExternalId.size, 0);
  assert.deepEqual(plan.edges, []);
});

test("planKnowledgeGraph creates pack/version/source-document/chunk nodes", () => {
  const plan = planKnowledgeGraph({
    packId: "easy-auth",
    packName: "Easy Auth",
    version: makeVersion(),
  });
  assert.ok(plan.nodesByExternalId.has("pack:easy-auth"));
  assert.ok(plan.nodesByExternalId.has("version:ver-1"));
  assert.ok(plan.nodesByExternalId.has("source-document:doc-1"));
  assert.ok(plan.nodesByExternalId.has("chunk:chunk-1"));

  const types = nodeTypesOf(plan.nodesByExternalId);
  assert.ok(types.includes("PACK"));
  assert.ok(types.includes("VERSION"));
  assert.ok(types.includes("SOURCE_DOCUMENT"));
  assert.ok(types.includes("CHUNK"));
});

test("planKnowledgeGraph creates structural edges", () => {
  const plan = planKnowledgeGraph({
    packId: "easy-auth",
    packName: "Easy Auth",
    version: makeVersion(),
  });
  const types = edgeTypes(plan.edges);
  assert.ok(types.has("PACK_HAS_VERSION"));
  assert.ok(types.has("VERSION_HAS_SOURCE_DOCUMENT"));
  assert.ok(types.has("VERSION_HAS_CHUNK"));
});

test("planKnowledgeGraph links chunk to its source document (both directions)", () => {
  const plan = planKnowledgeGraph({
    packId: "easy-auth",
    packName: "Easy Auth",
    version: makeVersion(),
  });
  const types = edgeTypes(plan.edges);
  assert.ok(types.has("SOURCE_DOCUMENT_HAS_CHUNK"));
  assert.ok(types.has("CHUNK_REFERENCES_SOURCE_DOCUMENT"));
});

test("planKnowledgeGraph creates TAG nodes and CHUNK_HAS_TAG edges", () => {
  const plan = planKnowledgeGraph({
    packId: "easy-auth",
    packName: "Easy Auth",
    version: makeVersion(),
  });
  assert.ok(plan.nodesByExternalId.has("tag:callback"));
  assert.ok(plan.nodesByExternalId.has("tag:java"));
  assert.ok(edgeTypes(plan.edges).has("CHUNK_HAS_TAG"));
});

test("planKnowledgeGraph creates METADATA_VALUE nodes for allowed metadata", () => {
  const plan = planKnowledgeGraph({
    packId: "easy-auth",
    packName: "Easy Auth",
    version: makeVersion(),
  });
  assert.ok(plan.nodesByExternalId.has("metadata:documentType:sample_code"));
  assert.ok(plan.nodesByExternalId.has("metadata:programmingLanguage:java"));
  assert.ok(edgeTypes(plan.edges).has("CHUNK_HAS_METADATA"));
});

test("planKnowledgeGraph excludes sensitive metadata keys from the graph", () => {
  const plan = planKnowledgeGraph({
    packId: "easy-auth",
    packName: "Easy Auth",
    version: makeVersion({
      chunks: [
        {
          id: "chunk-1",
          title: "Callback 처리",
          content: "본문",
          sourceDocumentId: null,
          tags: [],
          metadata: { apiKey: "secret-value" },
        },
      ],
    }),
  });
  const metadataNodes = Array.from(plan.nodesByExternalId.values()).filter(
    (n) => n.nodeType === "METADATA_VALUE",
  );
  assert.equal(metadataNodes.length, 0);
});

test("planKnowledgeGraph dedupes repeated tag / metadata value nodes across chunks", () => {
  const plan = planKnowledgeGraph({
    packId: "easy-auth",
    packName: "Easy Auth",
    version: makeVersion({
      chunks: [
        {
          id: "chunk-1",
          title: "A",
          content: "본문 A",
          sourceDocumentId: null,
          tags: ["java"],
          metadata: { programmingLanguage: "Java" },
        },
        {
          id: "chunk-2",
          title: "B",
          content: "본문 B",
          sourceDocumentId: null,
          tags: ["java"],
          metadata: { programmingLanguage: "Java" },
        },
      ],
    }),
  });
  const tagNodes = Array.from(plan.nodesByExternalId.keys()).filter((k) => k === "tag:java");
  assert.equal(tagNodes.length, 1);
  const metaNodes = Array.from(plan.nodesByExternalId.keys()).filter(
    (k) => k === "metadata:programmingLanguage:java",
  );
  assert.equal(metaNodes.length, 1);
});
