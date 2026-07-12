import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertSafeE2ETargets,
  buildDistributionE2EEnv,
  dedicatedE2E,
} from "../../test/distribution-e2e-safety.mjs";

describe("Distribution E2E safety guard", () => {
  it("default builder ignores ambient DATABASE_URL and S3 env", () => {
    const env = buildDistributionE2EEnv({
      ...process.env,
      DATABASE_URL: "postgresql://prod:secret@db.example.com:5432/jykstore_prod",
      JYKSTORE_PAYLOAD_S3_ENDPOINT: "https://s3.amazonaws.com",
      JYKSTORE_PAYLOAD_S3_BUCKET: "prod-payloads",
      JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID: "AKIAPROD",
      JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY: "prod-secret",
      JYKSTORE_ANONYMOUS_ID_SECRET: "prod-anon",
    });

    assert.equal(env.DATABASE_URL, dedicatedE2E.databaseUrl);
    assert.equal(env.JYKSTORE_PAYLOAD_S3_ENDPOINT, dedicatedE2E.s3Endpoint);
    assert.equal(env.JYKSTORE_PAYLOAD_S3_BUCKET, dedicatedE2E.s3Bucket);
    assert.equal(env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID, dedicatedE2E.s3AccessKeyId);
    assert.equal(env.JYKSTORE_ANONYMOUS_ID_SECRET, dedicatedE2E.anonymousSecret);
  });

  it("rejects database names without e2e", () => {
    assert.throws(
      () =>
        assertSafeE2ETargets({
          DATABASE_URL: "postgresql://jykstore:jykstore@127.0.0.1:5432/jykstore",
          JYKSTORE_PAYLOAD_S3_ENDPOINT: "http://127.0.0.1:59000",
          JYKSTORE_PAYLOAD_S3_BUCKET: "jykstore-payloads-e2e",
        }),
      /Unsafe E2E database target/,
    );
  });

  it("rejects bucket names without e2e", () => {
    assert.throws(
      () =>
        assertSafeE2ETargets({
          DATABASE_URL: dedicatedE2E.databaseUrl,
          JYKSTORE_PAYLOAD_S3_ENDPOINT: "http://127.0.0.1:59000",
          JYKSTORE_PAYLOAD_S3_BUCKET: "jykstore-payloads",
        }),
      /Unsafe E2E bucket target/,
    );
  });

  it("rejects external endpoint without allow flag", () => {
    assert.throws(
      () =>
        assertSafeE2ETargets({
          DATABASE_URL: dedicatedE2E.databaseUrl,
          JYKSTORE_PAYLOAD_S3_ENDPOINT: "https://minio.example.com",
          JYKSTORE_PAYLOAD_S3_BUCKET: "jykstore-payloads-e2e",
        }),
      /External E2E endpoint is not allowed/,
    );
  });

  it("allows external endpoint with flag when db/bucket include e2e", () => {
    const env = buildDistributionE2EEnv({
      ...process.env,
      JYKSTORE_ALLOW_EXTERNAL_DISTRIBUTION_E2E: "1",
      DATABASE_URL: "postgresql://u:p@minio.example.com:5432/jykstore_external_e2e",
      JYKSTORE_PAYLOAD_S3_ENDPOINT: "https://minio.example.com",
      JYKSTORE_PAYLOAD_S3_BUCKET: "team-payloads-e2e",
      JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID: "ak",
      JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY: "sk",
      JYKSTORE_ANONYMOUS_ID_SECRET: "external-e2e-secret",
    });

    assert.equal(env.DATABASE_URL, "postgresql://u:p@minio.example.com:5432/jykstore_external_e2e");
    assert.equal(env.JYKSTORE_PAYLOAD_S3_ENDPOINT, "https://minio.example.com");
    assert.equal(env.JYKSTORE_PAYLOAD_S3_BUCKET, "team-payloads-e2e");
  });
});
