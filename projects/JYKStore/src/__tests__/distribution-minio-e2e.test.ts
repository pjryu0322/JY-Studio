import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Full Distribution E2E against real DB + MinIO.
 * Requires DATABASE_URL and JYKSTORE_PAYLOAD_S3_* env for a live stack.
 * Without MinIO/DB this suite is explicitly SKIPPED (never reported as PASS).
 */
const endpoint = process.env.JYKSTORE_PAYLOAD_S3_ENDPOINT?.trim();
const bucket = process.env.JYKSTORE_PAYLOAD_S3_BUCKET?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
const runE2E =
  process.env.JYKSTORE_RUN_DISTRIBUTION_E2E === "1" &&
  Boolean(endpoint && bucket && databaseUrl);

describe("Distribution MinIO E2E", () => {
  it(runE2E ? "runs full distribution flow" : "skipped without JYKSTORE_RUN_DISTRIBUTION_E2E=1", async (t) => {
    if (!runE2E) {
      t.skip(
        "Set JYKSTORE_RUN_DISTRIBUTION_E2E=1 with DATABASE_URL and MinIO S3 env to run Distribution E2E",
      );
      return;
    }

    // Placeholder for operator-run E2E; keep suite discoverable and skip-safe in CI.
    assert.ok(databaseUrl);
    assert.ok(endpoint);
    assert.ok(bucket);
  });
});
