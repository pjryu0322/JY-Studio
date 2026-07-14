import type { KnowledgePackFileRole } from "@prisma/client";
import { DoclingImportError } from "@/lib/docling-import/docling-import-errors";

export type DoclingUploadFileRole = "SOURCE_ORIGINAL" | "DOCLING_JSON" | "DOCLING_MARKDOWN";

export type DoclingUploadPolicy = {
  maxSourceBytes: number;
  maxJsonBytes: number;
  maxMarkdownBytes: number;
  maxBundleBytes: number;
  multipartPartBytes: number;
  multipartConcurrency: number;
  uploadSessionTtlSeconds: number;
  presignedUrlTtlSeconds: number;
};

const DEFAULTS: DoclingUploadPolicy = {
  maxSourceBytes: 1_073_741_824, // 1 GiB
  maxJsonBytes: 1_073_741_824, // 1 GiB
  maxMarkdownBytes: 536_870_912, // 512 MiB
  maxBundleBytes: 2_147_483_648, // 2 GiB
  multipartPartBytes: 16_777_216, // 16 MiB
  multipartConcurrency: 3,
  uploadSessionTtlSeconds: 86_400, // 24h
  presignedUrlTtlSeconds: 900, // 15m
};

/** Absolute ceilings — env may not exceed these. */
export const DOCLING_UPLOAD_HARD_CAPS = {
  maxFileBytes: 5 * 1024 * 1024 * 1024, // 5 GiB
  maxBundleBytes: 10 * 1024 * 1024 * 1024, // 10 GiB
  minPartBytes: 5 * 1024 * 1024, // 5 MiB
  maxPartNumber: 10_000,
  minPartNumber: 1,
} as const;

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  hardCap: number,
  label: string,
  warnings: string[],
): number {
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || Number.isNaN(parsed)) {
    warnings.push(`Invalid ${label}=${raw}; using default ${fallback}`);
    return fallback;
  }
  if (parsed > hardCap) {
    warnings.push(`${label}=${parsed} exceeds hard cap ${hardCap}; using ${hardCap}`);
    return hardCap;
  }
  return parsed;
}

export function resolveDoclingUploadPolicy(
  env: NodeJS.ProcessEnv = process.env,
): { policy: DoclingUploadPolicy; warnings: string[] } {
  const warnings: string[] = [];
  const fileCap = DOCLING_UPLOAD_HARD_CAPS.maxFileBytes;
  const bundleCap = DOCLING_UPLOAD_HARD_CAPS.maxBundleBytes;

  const maxSourceBytes = parsePositiveInt(
    env.JYKSTORE_DOCLING_MAX_SOURCE_BYTES,
    DEFAULTS.maxSourceBytes,
    fileCap,
    "JYKSTORE_DOCLING_MAX_SOURCE_BYTES",
    warnings,
  );
  const maxJsonBytes = parsePositiveInt(
    env.JYKSTORE_DOCLING_MAX_JSON_BYTES,
    DEFAULTS.maxJsonBytes,
    fileCap,
    "JYKSTORE_DOCLING_MAX_JSON_BYTES",
    warnings,
  );
  const maxMarkdownBytes = parsePositiveInt(
    env.JYKSTORE_DOCLING_MAX_MARKDOWN_BYTES,
    DEFAULTS.maxMarkdownBytes,
    fileCap,
    "JYKSTORE_DOCLING_MAX_MARKDOWN_BYTES",
    warnings,
  );
  const maxBundleBytes = parsePositiveInt(
    env.JYKSTORE_DOCLING_MAX_BUNDLE_BYTES,
    DEFAULTS.maxBundleBytes,
    bundleCap,
    "JYKSTORE_DOCLING_MAX_BUNDLE_BYTES",
    warnings,
  );

  let multipartPartBytes = parsePositiveInt(
    env.JYKSTORE_DOCLING_MULTIPART_PART_BYTES,
    DEFAULTS.multipartPartBytes,
    fileCap,
    "JYKSTORE_DOCLING_MULTIPART_PART_BYTES",
    warnings,
  );
  if (multipartPartBytes < DOCLING_UPLOAD_HARD_CAPS.minPartBytes) {
    warnings.push(
      `JYKSTORE_DOCLING_MULTIPART_PART_BYTES=${multipartPartBytes} below min ${DOCLING_UPLOAD_HARD_CAPS.minPartBytes}; using min`,
    );
    multipartPartBytes = DOCLING_UPLOAD_HARD_CAPS.minPartBytes;
  }

  const multipartConcurrency = parsePositiveInt(
    env.JYKSTORE_DOCLING_MULTIPART_CONCURRENCY,
    DEFAULTS.multipartConcurrency,
    32,
    "JYKSTORE_DOCLING_MULTIPART_CONCURRENCY",
    warnings,
  );
  const uploadSessionTtlSeconds = parsePositiveInt(
    env.JYKSTORE_DOCLING_UPLOAD_SESSION_TTL_SECONDS,
    DEFAULTS.uploadSessionTtlSeconds,
    7 * 24 * 3600,
    "JYKSTORE_DOCLING_UPLOAD_SESSION_TTL_SECONDS",
    warnings,
  );
  const presignedUrlTtlSeconds = parsePositiveInt(
    env.JYKSTORE_DOCLING_PRESIGNED_URL_TTL_SECONDS,
    DEFAULTS.presignedUrlTtlSeconds,
    3600,
    "JYKSTORE_DOCLING_PRESIGNED_URL_TTL_SECONDS",
    warnings,
  );

  const policy: DoclingUploadPolicy = {
    maxSourceBytes,
    maxJsonBytes,
    maxMarkdownBytes,
    maxBundleBytes,
    multipartPartBytes,
    multipartConcurrency,
    uploadSessionTtlSeconds,
    presignedUrlTtlSeconds,
  };

  if (warnings.length > 0 && typeof console !== "undefined") {
    console.warn("[docling-upload-policy]", warnings.join("; "));
  }

  return { policy, warnings };
}

export function getDoclingUploadPolicy(
  env: NodeJS.ProcessEnv = process.env,
): DoclingUploadPolicy {
  return resolveDoclingUploadPolicy(env).policy;
}

export function maxBytesForRole(
  role: KnowledgePackFileRole | DoclingUploadFileRole,
  policy: DoclingUploadPolicy = getDoclingUploadPolicy(),
): number {
  switch (role) {
    case "SOURCE_ORIGINAL":
      return policy.maxSourceBytes;
    case "DOCLING_JSON":
      return policy.maxJsonBytes;
    case "DOCLING_MARKDOWN":
      return policy.maxMarkdownBytes;
    default:
      return Math.min(policy.maxSourceBytes, policy.maxJsonBytes, policy.maxMarkdownBytes);
  }
}

export function assertFileWithinPolicy(
  role: KnowledgePackFileRole | DoclingUploadFileRole,
  sizeBytes: number,
  policy: DoclingUploadPolicy = getDoclingUploadPolicy(),
): void {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new DoclingImportError(
      "DOCLING_FILE_REQUIRED",
      "빈 파일은 업로드할 수 없습니다.",
      400,
    );
  }
  const max = maxBytesForRole(role, policy);
  if (sizeBytes > max) {
    throw new DoclingImportError(
      "DOCLING_FILE_TOO_LARGE",
      `파일이 최대 크기(${formatByteSize(max)})를 초과했습니다.`,
      413,
    );
  }
}

export function assertBundleWithinPolicy(
  totalBytes: number,
  policy: DoclingUploadPolicy = getDoclingUploadPolicy(),
): void {
  if (totalBytes > policy.maxBundleBytes) {
    throw new DoclingImportError(
      "DOCLING_BUNDLE_TOO_LARGE",
      `번들 크기가 최대(${formatByteSize(policy.maxBundleBytes)})를 초과했습니다.`,
      413,
    );
  }
}

export function assertPartNumberValid(partNumber: number): void {
  if (
    !Number.isInteger(partNumber) ||
    partNumber < DOCLING_UPLOAD_HARD_CAPS.minPartNumber ||
    partNumber > DOCLING_UPLOAD_HARD_CAPS.maxPartNumber
  ) {
    throw new DoclingImportError(
      "DOCLING_INVALID_PART_NUMBER",
      `파트 번호는 ${DOCLING_UPLOAD_HARD_CAPS.minPartNumber}..${DOCLING_UPLOAD_HARD_CAPS.maxPartNumber} 범위여야 합니다.`,
      400,
    );
  }
}

export function computePartCount(fileSizeBytes: number, partSizeBytes: number): number {
  if (fileSizeBytes <= 0 || partSizeBytes <= 0) return 0;
  const count = Math.ceil(fileSizeBytes / partSizeBytes);
  if (count > DOCLING_UPLOAD_HARD_CAPS.maxPartNumber) {
    throw new DoclingImportError(
      "DOCLING_TOO_MANY_PARTS",
      `파트가 너무 많습니다 (최대 ${DOCLING_UPLOAD_HARD_CAPS.maxPartNumber}). 파트 크기를 늘리세요.`,
      400,
    );
  }
  return count;
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const units = ["KiB", "MiB", "GiB", "TiB"] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]} (${bytes} bytes)`;
}

export function toUploadPolicyDto(policy: DoclingUploadPolicy = getDoclingUploadPolicy()) {
  return {
    maxSourceBytes: policy.maxSourceBytes,
    maxJsonBytes: policy.maxJsonBytes,
    maxMarkdownBytes: policy.maxMarkdownBytes,
    maxBundleBytes: policy.maxBundleBytes,
    multipartPartBytes: policy.multipartPartBytes,
    multipartConcurrency: policy.multipartConcurrency,
    uploadSessionTtlSeconds: policy.uploadSessionTtlSeconds,
    presignedUrlTtlSeconds: policy.presignedUrlTtlSeconds,
    hardCaps: {
      maxFileBytes: DOCLING_UPLOAD_HARD_CAPS.maxFileBytes,
      maxBundleBytes: DOCLING_UPLOAD_HARD_CAPS.maxBundleBytes,
      minPartBytes: DOCLING_UPLOAD_HARD_CAPS.minPartBytes,
      maxPartNumber: DOCLING_UPLOAD_HARD_CAPS.maxPartNumber,
    },
  };
}
