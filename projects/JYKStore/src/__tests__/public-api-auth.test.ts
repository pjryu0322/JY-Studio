import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractBearerToken,
  hasRequiredScope,
  requireApiKeyScope,
  type ApiKeyAuthResult,
} from "../../src/lib/api-key-auth.ts";
import { mapAuthFailureToPublicCode } from "../../src/lib/public-api-handler.ts";

describe("public api auth helpers", () => {
  it("extracts Bearer token and rejects missing/malformed headers", () => {
    assert.equal(
      extractBearerToken(new Request("http://localhost", { headers: { Authorization: "Bearer abc" } })),
      "abc",
    );
    assert.equal(extractBearerToken(new Request("http://localhost")), null);
    assert.equal(
      extractBearerToken(
        new Request("http://localhost", { headers: { Authorization: "Basic abc" } }),
      ),
      null,
    );
  });

  it("maps auth failure codes for Public API responses", () => {
    assert.equal(mapAuthFailureToPublicCode("UNAUTHORIZED"), "UNAUTHORIZED");
    assert.equal(mapAuthFailureToPublicCode("API_KEY_REVOKED"), "API_KEY_REVOKED");
    assert.equal(mapAuthFailureToPublicCode("API_KEY_EXPIRED"), "API_KEY_EXPIRED");
    assert.equal(mapAuthFailureToPublicCode("INSUFFICIENT_SCOPE"), "INSUFFICIENT_SCOPE");
    assert.equal(mapAuthFailureToPublicCode("FORBIDDEN"), "FORBIDDEN");
  });

  it("simulates successful auth payload for usage logging", () => {
    const success: ApiKeyAuthResult = {
      ok: true,
      apiKeyId: "key_success",
      clientId: "client_1",
      scopes: ["context:read"],
    };
    const scoped = requireApiKeyScope(success, "context:read");
    assert.equal(scoped.ok, true);
    if (scoped.ok) {
      assert.equal(scoped.apiKeyId, "key_success");
    }
  });

  it("covers revoked/expired/insufficient scope failure shapes", () => {
    const cases: Array<{ code: "API_KEY_REVOKED" | "API_KEY_EXPIRED" | "INSUFFICIENT_SCOPE" }> = [
      { code: "API_KEY_REVOKED" },
      { code: "API_KEY_EXPIRED" },
      { code: "INSUFFICIENT_SCOPE" },
    ];
    for (const item of cases) {
      const failure: ApiKeyAuthResult = {
        ok: false,
        status: 403,
        code: item.code,
        error: "denied",
      };
      assert.equal(failure.ok, false);
      if (!failure.ok) {
        assert.equal(mapAuthFailureToPublicCode(failure.code), item.code);
      }
    }
    assert.equal(hasRequiredScope([], "context:read"), false);
  });
});
