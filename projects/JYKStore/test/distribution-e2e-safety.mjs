/**
 * Dedicated Distribution E2E targets and safety guards.
 * Default runner must ignore ambient shell DATABASE_URL / S3 env.
 */

export const dedicatedE2E = {
  databaseUrl:
    "postgresql://jykstore:jykstore@127.0.0.1:55432/jykstore_distribution_e2e?schema=public",
  s3Endpoint: "http://127.0.0.1:59000",
  s3Region: "ap-northeast-2",
  s3Bucket: "jykstore-payloads-e2e",
  s3AccessKeyId: "jykstoreminio",
  s3SecretAccessKey: "jykstoreminio123",
  anonymousSecret: "e2e-only-secret",
};

function dbNameFromUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  return url.pathname.replace(/^\//, "").split("?")[0];
}

/**
 * Fail closed unless DB/bucket look like E2E and endpoint is local
 * (or external mode is explicitly allowed).
 */
export function assertSafeE2ETargets(env) {
  const databaseUrl = env.DATABASE_URL?.trim();
  const bucket = env.JYKSTORE_PAYLOAD_S3_BUCKET?.trim();
  const endpointRaw = env.JYKSTORE_PAYLOAD_S3_ENDPOINT?.trim();

  if (!databaseUrl) {
    throw new Error("Unsafe E2E database target: DATABASE_URL is missing");
  }
  if (!bucket) {
    throw new Error("Unsafe E2E bucket target: bucket is missing");
  }
  if (!endpointRaw) {
    throw new Error("Unsafe E2E endpoint: endpoint is missing");
  }

  let dbName;
  try {
    dbName = dbNameFromUrl(databaseUrl);
  } catch {
    throw new Error("Unsafe E2E database target: invalid DATABASE_URL");
  }

  if (!/e2e/i.test(dbName)) {
    throw new Error(`Unsafe E2E database target: db name "${dbName}" must include e2e`);
  }

  if (!/e2e/i.test(bucket)) {
    throw new Error(`Unsafe E2E bucket target: bucket "${bucket}" must include e2e`);
  }

  let endpoint;
  try {
    endpoint = new URL(endpointRaw);
  } catch {
    throw new Error("Unsafe E2E endpoint: invalid URL");
  }

  const localHost = ["127.0.0.1", "localhost"].includes(endpoint.hostname);
  const allowExternal = env.JYKSTORE_ALLOW_EXTERNAL_DISTRIBUTION_E2E === "1";

  if (!localHost && !allowExternal) {
    throw new Error("External E2E endpoint is not allowed");
  }
}

/**
 * Build env for Distribution E2E.
 * Without JYKSTORE_ALLOW_EXTERNAL_DISTRIBUTION_E2E=1, always use dedicatedE2E
 * and overwrite ambient DATABASE_URL / S3 credentials.
 */
export function buildDistributionE2EEnv(processEnv = process.env) {
  const allowExternal = processEnv.JYKSTORE_ALLOW_EXTERNAL_DISTRIBUTION_E2E === "1";

  /** @type {NodeJS.ProcessEnv} */
  const env = allowExternal
    ? {
        ...processEnv,
        JYKSTORE_RUN_DISTRIBUTION_E2E: "1",
        JYKSTORE_PAYLOAD_STORAGE_DRIVER: "s3",
        JYKSTORE_PAYLOAD_S3_FORCE_PATH_STYLE:
          processEnv.JYKSTORE_PAYLOAD_S3_FORCE_PATH_STYLE?.trim() || "true",
        JYKSTORE_TRUST_PROXY: processEnv.JYKSTORE_TRUST_PROXY?.trim() || "true",
      }
    : {
        ...processEnv,
        JYKSTORE_RUN_DISTRIBUTION_E2E: "1",
        DATABASE_URL: dedicatedE2E.databaseUrl,
        JYKSTORE_PAYLOAD_STORAGE_DRIVER: "s3",
        JYKSTORE_PAYLOAD_S3_ENDPOINT: dedicatedE2E.s3Endpoint,
        JYKSTORE_PAYLOAD_S3_REGION: dedicatedE2E.s3Region,
        JYKSTORE_PAYLOAD_S3_BUCKET: dedicatedE2E.s3Bucket,
        JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID: dedicatedE2E.s3AccessKeyId,
        JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY: dedicatedE2E.s3SecretAccessKey,
        JYKSTORE_PAYLOAD_S3_FORCE_PATH_STYLE: "true",
        JYKSTORE_PAYLOAD_S3_SERVER_SIDE_ENCRYPTION: "",
        JYKSTORE_ANONYMOUS_ID_SECRET: dedicatedE2E.anonymousSecret,
        JYKSTORE_TRUST_PROXY: "true",
      };

  assertSafeE2ETargets(env);
  return env;
}
