import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPlainApiKey,
  getApiKeyPrefix,
  hashApiKey,
  maskApiKey,
  safeCompareHash,
} from "../../src/lib/api-key-crypto.ts";
import {
  apiKeyStatusLabel,
  resolveApiKeyDisplayStatus,
  toApiKeyDto,
} from "../../src/lib/api-key-dto.ts";
import { hasRequiredScope, requireApiKeyScope } from "../../src/lib/api-key-auth.ts";
import { PUBLIC_API_REQUIRED_SCOPE } from "../../src/lib/api-key-service.ts";
import type { ApiKey } from "@prisma/client";

function sampleRow(overrides?: Partial<ApiKey>): ApiKey {
  const now = new Date("2026-07-08T12:00:00.000Z");
  return {
    id: "key_1",
    clientId: "client_1",
    userId: null,
    organizationId: null,
    name: "Local MCP key",
    keyPrefix: "jyk_live_abcdef",
    keyHash: "hash",
    scopes: ["context:read", "packs:read"],
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    lastUsedAt: null,
    revokedAt: null,
    expiresAt: null,
    ...overrides,
  };
}

describe("api-key crypto helpers", () => {
  it("creates jyk_live_ keys and hashes without storing plain text side effects", () => {
    const plain = createPlainApiKey();
    assert.match(plain, /^jyk_live_[a-f0-9]{64}$/);
    const prefix = getApiKeyPrefix(plain);
    assert.equal(prefix.length, 16);
    assert.equal(prefix, plain.slice(0, 16));
    const hashed = hashApiKey(plain);
    assert.notEqual(hashed, plain);
    assert.equal(safeCompareHash(hashed, hashApiKey(plain)), true);
    assert.equal(safeCompareHash(hashed, hashApiKey("jyk_live_other")), false);
  });

  it("masks keys and prefixes for list display", () => {
    const plain = "jyk_live_abcdef0123456789deadbeef";
    const masked = maskApiKey(plain);
    assert.ok(masked.includes("…"));
    assert.ok(!masked.includes(plain.slice(16, 24)));
    assert.equal(maskApiKey("jyk_live_abcdef").includes("…"), true);
  });
});

describe("api-key dto status resolution", () => {
  it("marks revoked and expired keys", () => {
    const now = new Date("2026-07-08T12:00:00.000Z");
    assert.equal(resolveApiKeyDisplayStatus(sampleRow({ status: "REVOKED" }), now), "REVOKED");
    assert.equal(
      resolveApiKeyDisplayStatus(
        sampleRow({
          status: "ACTIVE",
          expiresAt: new Date("2026-07-01T00:00:00.000Z"),
        }),
        now,
      ),
      "EXPIRED",
    );
    assert.equal(resolveApiKeyDisplayStatus(sampleRow({ status: "EXPIRED" }), now), "EXPIRED");
    assert.equal(resolveApiKeyDisplayStatus(sampleRow(), now), "ACTIVE");
  });

  it("exposes maskedKey and never includes raw material beyond prefix", () => {
    const dto = toApiKeyDto(sampleRow());
    assert.equal(dto.maskedKey, maskApiKey("jyk_live_abcdef"));
    assert.equal(dto.status, "ACTIVE");
    assert.ok(dto.scopes.includes("context:read"));
    assert.equal(dto.expiresAt, null);
    assert.equal(apiKeyStatusLabel("EXPIRED"), "만료됨");
  });
});

describe("api-key scope helpers", () => {
  it("treats context:read as required public scope", () => {
    assert.equal(PUBLIC_API_REQUIRED_SCOPE, "context:read");
    assert.equal(hasRequiredScope(["context:read"], "context:read"), true);
    assert.equal(hasRequiredScope(["*"], "context:read"), true);
    assert.equal(hasRequiredScope(["packs:read"], "context:read"), false);
  });

  it("requireApiKeyScope returns INSUFFICIENT_SCOPE without leaking keys", () => {
    const denied = requireApiKeyScope(
      { ok: true, apiKeyId: "key_1", clientId: "c1", scopes: ["packs:read"] },
      "context:read",
    );
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.code, "INSUFFICIENT_SCOPE");
      assert.equal(denied.status, 403);
      assert.ok(!denied.error.includes("jyk_live_"));
    }
  });
});
