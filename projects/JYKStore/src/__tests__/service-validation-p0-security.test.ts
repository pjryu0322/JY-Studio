import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertServiceChannelEnabled,
  selectedServiceChannels,
} from "../lib/distribution/service-channel-policy.ts";
import { resolveRunCurrentValidity } from "../lib/distribution/service-validation-service.ts";
import { evaluateRetrievalValidationHits } from "../lib/retrieval/retrieval-api-adapter.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("P0 channel spoofing defenses", () => {
  it("public retrieval route rejects X-JYK-Service-Channel and fixes API channel", () => {
    const root = join(import.meta.dirname, "../..");
    const route = readFileSync(
      join(root, "src/app/api/v1/retrieval/query/route.ts"),
      "utf8",
    );
    assert.ok(route.includes("SERVICE_CHANNEL_SPOOFING_NOT_ALLOWED"));
    assert.ok(route.includes('serviceChannel: "API"'));
    assert.ok(!route.includes('=== "MCP"'));
  });

  it("MCP retrieval uses dedicated route and mcp:invoke scope", () => {
    const root = join(import.meta.dirname, "../..");
    const mcpRoute = readFileSync(
      join(root, "src/app/api/v1/mcp/retrieval/query/route.ts"),
      "utf8",
    );
    const client = readFileSync(join(root, "mcp-server/jykstore-client.ts"), "utf8");
    const tools = readFileSync(join(root, "mcp-server/tool-handlers.ts"), "utf8");
    const keyService = readFileSync(join(root, "src/lib/api-key-service.ts"), "utf8");
    assert.ok(mcpRoute.includes("PUBLIC_API_MCP_SCOPE"));
    assert.ok(mcpRoute.includes('serviceChannel: "MCP"'));
    assert.ok(keyService.includes('PUBLIC_API_MCP_SCOPE = "mcp:invoke"'));
    assert.ok(!client.includes("X-JYK-Service-Channel"));
    assert.ok(tools.includes("/api/v1/mcp/retrieval/query"));
  });

  it("allowApi=false blocks API while allowMcp can still pass MCP assert", () => {
    const api = assertServiceChannelEnabled("API", {
      allowApi: false,
      allowMcp: true,
      allowDownload: false,
      serviceEndsAt: null,
    });
    assert.equal(api.ok, false);
    const mcp = assertServiceChannelEnabled("MCP", {
      allowApi: false,
      allowMcp: true,
      allowDownload: false,
      serviceEndsAt: null,
    });
    assert.equal(mcp.ok, true);
  });
});

describe("P0 validation validity and hits", () => {
  it("keeps historical PASS current when invalidatedAt is null and binding matches", () => {
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "fp1",
          indexGenerationId: "gen1",
          invalidatedAt: null,
        },
        bindingFingerprint: "fp1",
        bindingIndexGenerationId: "gen1",
      }),
      "CURRENT",
    );
  });

  it("marks CURRENT binding drift as STALE without requiring status overwrite", () => {
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "fp-old",
          indexGenerationId: "gen1",
          invalidatedAt: null,
        },
        bindingFingerprint: "fp-new",
        bindingIndexGenerationId: "gen1",
      }),
      "STALE",
    );
    assert.equal(
      resolveRunCurrentValidity({
        run: {
          status: "PASS",
          fingerprint: "fp1",
          indexGenerationId: "gen1",
          invalidatedAt: new Date(),
        },
        bindingFingerprint: "fp1",
        bindingIndexGenerationId: "gen1",
      }),
      "STALE",
    );
  });

  it("rejects foreign version or missing provenance in retrieval hits", () => {
    const foreign = evaluateRetrievalValidationHits({
      data: {
        contexts: [
          {
            chunkId: "c1",
            knowledgePackId: "p1",
            title: "t",
            content: "x",
            score: 1,
            matchReasons: [],
            metadata: { versionId: "other", page: 1, sourceDocumentId: "doc-1" },
          },
        ],
        usage: {
          requestId: "r1",
          contextCount: 1,
          topK: 5,
          usedFilters: {},
          retrievalMode: "hybrid",
          scannedCandidateCount: 1,
          filteredCandidateCount: 1,
          candidateCollectionMode: "query-scan",
        },
      },
      expectedVersionId: "ver-1",
    });
    assert.equal(foreign.ok, false);

    const missingSource = evaluateRetrievalValidationHits({
      data: {
        contexts: [
          {
            chunkId: "c1",
            knowledgePackId: "p1",
            title: "t",
            content: "x",
            score: 1,
            matchReasons: [],
            metadata: { versionId: "ver-1", page: 1 },
          },
        ],
        usage: {
          requestId: "r1",
          contextCount: 1,
          topK: 5,
          usedFilters: {},
          retrievalMode: "hybrid",
          scannedCandidateCount: 1,
          filteredCandidateCount: 1,
          candidateCollectionMode: "query-scan",
        },
      },
      expectedVersionId: "ver-1",
    });
    assert.equal(missingSource.ok, false);
    if (!missingSource.ok) {
      assert.match(missingSource.message, /출처/);
    }

    const ok = evaluateRetrievalValidationHits({
      data: {
        contexts: [
          {
            chunkId: "c1",
            knowledgePackId: "p1",
            title: "t",
            content: "x",
            score: 1,
            matchReasons: [],
            metadata: { versionId: "ver-1", page: 1 },
            references: [{ type: "SOURCE_DOCUMENT", title: "doc", sourceDocumentId: "doc-1" }],
          },
        ],
        usage: {
          requestId: "r1",
          contextCount: 1,
          topK: 5,
          usedFilters: {},
          retrievalMode: "hybrid",
          scannedCandidateCount: 1,
          filteredCandidateCount: 1,
          candidateCollectionMode: "query-scan",
        },
      },
      expectedVersionId: "ver-1",
    });
    assert.equal(ok.ok, true);
  });
});

describe("P0 source contracts", () => {
  it("uses real adapters and append-only create", () => {
    const root = join(import.meta.dirname, "../..");
    const service = readFileSync(
      join(root, "src/lib/distribution/service-validation-service.ts"),
      "utf8",
    );
    const admin = readFileSync(join(root, "src/lib/admin-review-service.ts"), "utf8");
    assert.ok(service.includes("executeRetrievalApiRequest"));
    assert.ok(service.includes("executeMcpValidation"));
    assert.ok(service.includes("validateDownloadObjectIntegrity"));
    assert.ok(service.includes("SERVICE_VALIDATION_NOT_EDITABLE"));
    assert.ok(service.includes("serviceValidationRun.create"));
    assert.ok(!service.includes("versionId_channel"));
    assert.ok(admin.includes("assertCurrentServiceValidationEvidence"));
    assert.ok(selectedServiceChannels({ allowApi: true, allowMcp: false, allowDownload: false }).includes("API"));
  });
});
