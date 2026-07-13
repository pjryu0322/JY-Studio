import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { PackStatus } from "@prisma/client";
import {
  isPackApiIntegrationReady,
  resolvePublicPackCapabilities,
  type PublicPackCapabilityInput,
} from "../lib/public-pack-capability.ts";

function baseInput(overrides: Partial<PublicPackCapabilityInput> = {}): PublicPackCapabilityInput {
  return {
    packStatus: PackStatus.PUBLISHED,
    distributionState: {
      kind: "DISTRIBUTION",
      visibility: "PUBLIC",
      allowDownload: true,
      artifact: "EXTERNAL_IMPORT",
    },
    catalogPurpose: "detail",
    normalizedDocumentReady: true,
    runtimeIndexReady: false,
    legacyKnowledgeChunkCount: 0,
    exportFormats: ["package"],
    mcpEnabled: true,
    ...overrides,
  };
}

describe("resolvePublicPackCapabilities", () => {
  it("marks download-only external import as catalog/download READY without context/retrieval/mcp", () => {
    const caps = resolvePublicPackCapabilities(baseInput());
    assert.equal(caps.catalog.status, "READY");
    assert.equal(caps.download.status, "READY");
    assert.equal(caps.normalizedDocument.status, "READY");
    assert.equal(caps.context.status, "NOT_BUILT");
    assert.equal(caps.retrieval.status, "NOT_BUILT");
    assert.equal(caps.mcp.status, "NOT_BUILT");
    assert.equal(isPackApiIntegrationReady(caps), false);
  });

  it("does not treat normalizedDocument alone as context READY", () => {
    const caps = resolvePublicPackCapabilities(
      baseInput({ normalizedDocumentReady: true, legacyKnowledgeChunkCount: 0 }),
    );
    assert.equal(caps.normalizedDocument.status, "READY");
    assert.equal(caps.context.status, "NOT_BUILT");
  });

  it("marks context/retrieval/mcp READY when legacy chunks exist", () => {
    const caps = resolvePublicPackCapabilities(baseInput({ legacyKnowledgeChunkCount: 2 }));
    assert.equal(caps.context.status, "READY");
    assert.equal(caps.retrieval.status, "READY");
    assert.equal(caps.mcp.status, "READY");
    assert.equal(isPackApiIntegrationReady(caps), true);
  });

  it("marks context READY when runtimeIndexReady even without chunks", () => {
    const caps = resolvePublicPackCapabilities(
      baseInput({ runtimeIndexReady: true, legacyKnowledgeChunkCount: 0 }),
    );
    assert.equal(caps.context.status, "READY");
    assert.equal(caps.retrieval.status, "READY");
  });

  it("keeps catalog READY for download-only packs (visibility unchanged)", () => {
    const caps = resolvePublicPackCapabilities(baseInput({ legacyKnowledgeChunkCount: 0 }));
    assert.equal(caps.catalog.status, "READY");
    assert.equal(caps.download.status, "READY");
  });
});

describe("public capability gated UI/API source contracts", () => {
  function readSource(rel: string) {
    return readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
  }

  it("ConnectActionButton requires READY context or retrieval", () => {
    const source = readSource("components/ConnectActionButton.tsx");
    assert.match(source, /isPackApiIntegrationReady/);
    assert.match(source, /return null/);
  });

  it("MyPackCard shows download without 연동하기 for non-ready API", () => {
    const source = readSource("components/MyPackCard.tsx");
    assert.match(source, /다운로드/);
    assert.match(source, /API 준비 중/);
    assert.match(source, /isPackApiIntegrationReady/);
  });

  it("connect route guards with capability check", () => {
    const source = readSource("app/(store)/my-packs/[packId]/connect/page.tsx");
    assert.match(source, /isPackApiIntegrationReady/);
    assert.match(source, /ConnectNotReadyPanel/);
  });

  it("API Key panel does not claim pack-specific key", () => {
    const source = readSource("components/SelectedPackApiKeyIssuePanel.tsx");
    assert.equal(source.includes("이 지식팩 연동용 API Key 발급"), false);
    assert.match(source, /특정 지식팩 전용 Key가 아닙니다/);
    assert.match(source, /"API Key 발급"/);
  });

  it("Context and Retrieval routes return capability 409 codes", () => {
    const context = readSource("lib/context-public-api-routes.ts");
    const retrieval = readSource("app/api/v1/retrieval/query/route.ts");
    assert.match(context, /PACK_CONTEXT_NOT_READY/);
    assert.match(retrieval, /PACK_RETRIEVAL_NOT_READY/);
  });
});
