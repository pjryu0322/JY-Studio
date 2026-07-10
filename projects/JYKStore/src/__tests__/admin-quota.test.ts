import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_QUOTA_POLICY } from "../../src/lib/quota-policy.ts";
import type { QuotaSummaryDto } from "../../src/lib/quota-summary-service.ts";

describe("admin quota summary dto shape", () => {
  it("summary contains policy/topClients without secrets", () => {
    const summary: QuotaSummaryDto = {
      range: "24h",
      policy: DEFAULT_QUOTA_POLICY,
      totalRequests: 10,
      quotaExceededCount: 1,
      topClients: [
        {
          clientId: "client_a",
          requestCount: 8,
          quotaExceededCount: 1,
          uniqueApiKeyCount: 1,
          topEndpoint: "/api/v1/retrieval/query",
        },
      ],
      topEndpoints: [{ endpoint: "/api/v1/retrieval/query", requestCount: 8 }],
    };
    const serialized = JSON.stringify(summary);
    assert.ok(serialized.includes("FREE"));
    assert.ok(serialized.includes("client_a"));
    assert.ok(!serialized.includes("rawKey"));
    assert.ok(!serialized.includes("Authorization"));
    assert.ok(!serialized.includes("jyk_live_"));
  });
});
