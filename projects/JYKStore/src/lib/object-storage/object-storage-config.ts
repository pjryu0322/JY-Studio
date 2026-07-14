import { PayloadServiceError } from "@/lib/distribution/payload-errors";

export type ObjectS3StorageConfig = {
  driver: "s3";
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  prefix: string;
  serverSideEncryption?: "AES256" | "aws:kms" | null;
};

/** @deprecated Prefer ObjectS3StorageConfig. */
export type PayloadS3StorageConfig = ObjectS3StorageConfig;

export type ObjectStorageConfigResult =
  | { ok: true; config: ObjectS3StorageConfig }
  | { ok: false; missing: string[]; errors: string[] };

/** @deprecated Prefer ObjectStorageConfigResult. */
export type PayloadStorageConfigResult = ObjectStorageConfigResult;

function truthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function sanitizePrefix(raw: string): string {
  return raw
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/{2,}/g, "/");
}

/**
 * Parse Object Storage env. Never logs secret values.
 * Still reads JYKSTORE_PAYLOAD_S3_* during the ZIP/Docling transition.
 */
export function parseObjectStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): ObjectStorageConfigResult {
  const driver = (env.JYKSTORE_PAYLOAD_STORAGE_DRIVER?.trim() || "s3").toLowerCase();
  if (driver !== "s3") {
    return {
      ok: false,
      missing: [],
      errors: [`Unsupported payload storage driver: ${driver}`],
    };
  }

  const missing: string[] = [];
  const region = env.JYKSTORE_PAYLOAD_S3_REGION?.trim() || "";
  const bucket = env.JYKSTORE_PAYLOAD_S3_BUCKET?.trim() || "";
  const accessKeyId = env.JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = env.JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY?.trim() || "";

  if (!region) missing.push("JYKSTORE_PAYLOAD_S3_REGION");
  if (!bucket) missing.push("JYKSTORE_PAYLOAD_S3_BUCKET");
  if (!accessKeyId) missing.push("JYKSTORE_PAYLOAD_S3_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("JYKSTORE_PAYLOAD_S3_SECRET_ACCESS_KEY");

  if (missing.length > 0) {
    return {
      ok: false,
      missing,
      errors: missing.map((name) => `Missing required env: ${name}`),
    };
  }

  const endpoint = env.JYKSTORE_PAYLOAD_S3_ENDPOINT?.trim() || undefined;
  const prefix = sanitizePrefix(env.JYKSTORE_PAYLOAD_S3_PREFIX?.trim() || "payloads");
  const sseRaw = env.JYKSTORE_PAYLOAD_S3_SERVER_SIDE_ENCRYPTION?.trim();
  let serverSideEncryption: ObjectS3StorageConfig["serverSideEncryption"] = "AES256";
  if (sseRaw === "" || sseRaw?.toLowerCase() === "none" || sseRaw?.toLowerCase() === "off") {
    serverSideEncryption = null;
  } else if (sseRaw === "AES256" || sseRaw === "aws:kms") {
    serverSideEncryption = sseRaw;
  }

  return {
    ok: true,
    config: {
      driver: "s3",
      endpoint,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      forcePathStyle: truthy(env.JYKSTORE_PAYLOAD_S3_FORCE_PATH_STYLE),
      prefix,
      serverSideEncryption,
    },
  };
}

/** @deprecated Prefer parseObjectStorageConfig. */
export const parsePayloadStorageConfig = parseObjectStorageConfig;

export function requireObjectStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): ObjectS3StorageConfig {
  const parsed = parseObjectStorageConfig(env);
  if (!parsed.ok) {
    throw new PayloadServiceError(
      "PAYLOAD_STORAGE_NOT_CONFIGURED",
      "Object Storage가 구성되지 않았습니다.",
      503,
    );
  }
  return parsed.config;
}

/** @deprecated Prefer requireObjectStorageConfig. */
export const requirePayloadStorageConfig = requireObjectStorageConfig;

/** ZIP KnowledgePayload object key — kept until ZIP removal. */
export function buildPayloadObjectKey(input: {
  prefix: string;
  packId: string;
  versionId: string;
  payloadId: string;
}): string {
  const safe = /^[a-zA-Z0-9_-]+$/;
  if (!safe.test(input.packId) || !safe.test(input.versionId) || !safe.test(input.payloadId)) {
    throw new Error("Invalid id for payload object key");
  }
  const prefix = sanitizePrefix(input.prefix || "payloads");
  return `${prefix}/${input.packId}/${input.versionId}/${input.payloadId}.zip`;
}

/** Immutable Docling pack-file object key (not ZIP). */
export function buildPackFileObjectKey(input: {
  prefix: string;
  packId: string;
  versionId: string;
  bundleId: string;
  fileId: string;
  role: string;
  extension: string;
}): string {
  const safe = /^[a-zA-Z0-9_-]+$/;
  if (
    !safe.test(input.packId) ||
    !safe.test(input.versionId) ||
    !safe.test(input.bundleId) ||
    !safe.test(input.fileId)
  ) {
    throw new Error("Invalid id for pack-file object key");
  }
  const role = input.role.replace(/[^A-Z0-9_]/gi, "").toUpperCase() || "FILE";
  const ext = input.extension.replace(/^\./, "").replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const prefix = sanitizePrefix(input.prefix || "payloads");
  return `${prefix}/pack-files/${input.packId}/${input.versionId}/${input.bundleId}/${role}/${input.fileId}.${ext}`;
}

/** Redacted view for readiness / logs — never includes secrets. */
export function describeObjectStorageConfig(
  config: ObjectS3StorageConfig,
): Record<string, unknown> {
  return {
    driver: config.driver,
    region: config.region,
    bucket: config.bucket,
    endpointConfigured: Boolean(config.endpoint),
    forcePathStyle: config.forcePathStyle,
    prefix: config.prefix,
    serverSideEncryption: config.serverSideEncryption,
    accessKeyConfigured: Boolean(config.accessKeyId),
  };
}

/** @deprecated Prefer describeObjectStorageConfig. */
export const describePayloadStorageConfig = describeObjectStorageConfig;
