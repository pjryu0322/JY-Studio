import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAdminOpsHeaders } from "../../src/lib/admin-api-keys-api.ts";
import { ADMIN_OPS_TOKEN_HEADER } from "../../src/lib/admin-auth.ts";
import { maskApiKey } from "../../src/lib/api-key-crypto.ts";
import { toApiKeyDto } from "../../src/lib/api-key-dto.ts";
import type { ApiKey } from "@prisma/client";

function sampleRow(): ApiKey {
  const now = new Date("2026-07-08T12:00:00.000Z");
  return {
    id: "key_1",
    clientId: "client_1",
    userId: null,
    organizationId: null,
    name: "Local MCP key",
    keyPrefix: "jyk_live_abcdef",
    keyHash: "hash-only",
    scopes: ["context:read"],
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    revokedAt: null,
    expiresAt: null,
  };
}

describe("api key response shape helpers", () => {
  it("list DTO exposes maskedKey and never rawKey/plainKey", () => {
    const dto = toApiKeyDto(sampleRow());
    assert.equal(dto.maskedKey, maskApiKey(sampleRow().keyPrefix));
    assert.equal("rawKey" in dto, false);
    assert.equal("plainKey" in dto, false);
    assert.equal("keyHash" in dto, false);
    assert.ok(Array.isArray(dto.scopes));
  });

  it("create response contract uses rawKey only (documented shape)", () => {
    const createResponse = {
      clientId: "client_1",
      rawKey: "jyk_live_abcdef0123456789deadbeefcafebabe",
      apiKey: toApiKeyDto(sampleRow()),
    };
    assert.ok("rawKey" in createResponse);
    assert.equal("plainKey" in createResponse, false);
    assert.equal("item" in createResponse, false);
    assert.ok(createResponse.apiKey.maskedKey);
    assert.ok(!JSON.stringify(createResponse.apiKey).includes(createResponse.rawKey.slice(20)));
  });
});

describe("admin api keys client headers", () => {
  it("buildAdminOpsHeaders sets X-JYKStore-Admin-Token", () => {
    const headers = buildAdminOpsHeaders("ops-token") as Record<string, string>;
    assert.equal(headers[ADMIN_OPS_TOKEN_HEADER], "ops-token");
    assert.deepEqual(buildAdminOpsHeaders("   "), {});
  });
});
