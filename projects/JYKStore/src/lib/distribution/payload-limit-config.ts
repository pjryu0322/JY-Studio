import {
  PAYLOAD_MAX_ENTRIES,
  PAYLOAD_MAX_PATH_LENGTH,
  PAYLOAD_MAX_SINGLE_ENTRY_BYTES,
  PAYLOAD_MAX_UNPACKED_BYTES,
  PAYLOAD_MAX_ZIP_BYTES,
} from "@/lib/distribution/payload-types";

export type PayloadLimitConfig = {
  maxZipBytes: number;
  maxEntries: number;
  maxUnpackedBytes: number;
  maxSingleEntryBytes: number;
  maxPathLength: number;
  maxCompressionRatio: number;
  compressionRatioMinUncompressedBytes: number;
};

const DEFAULTS: PayloadLimitConfig = {
  maxZipBytes: PAYLOAD_MAX_ZIP_BYTES,
  maxEntries: PAYLOAD_MAX_ENTRIES,
  maxUnpackedBytes: PAYLOAD_MAX_UNPACKED_BYTES,
  maxSingleEntryBytes: PAYLOAD_MAX_SINGLE_ENTRY_BYTES,
  maxPathLength: PAYLOAD_MAX_PATH_LENGTH,
  maxCompressionRatio: 100,
  compressionRatioMinUncompressedBytes: 1 * 1024 * 1024,
};

const HARD_CAPS: PayloadLimitConfig = {
  maxZipBytes: 500 * 1024 * 1024,
  maxEntries: 50_000,
  maxUnpackedBytes: 2 * 1024 * 1024 * 1024,
  maxSingleEntryBytes: 500 * 1024 * 1024,
  maxPathLength: 1024,
  maxCompressionRatio: 10_000,
  compressionRatioMinUncompressedBytes: 50 * 1024 * 1024,
};

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

export function resolvePayloadLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
): { config: PayloadLimitConfig; warnings: string[] } {
  const warnings: string[] = [];
  const config: PayloadLimitConfig = {
    maxZipBytes: parsePositiveInt(
      env.JYKSTORE_PAYLOAD_MAX_BYTES,
      DEFAULTS.maxZipBytes,
      HARD_CAPS.maxZipBytes,
      "JYKSTORE_PAYLOAD_MAX_BYTES",
      warnings,
    ),
    maxEntries: parsePositiveInt(
      env.JYKSTORE_PAYLOAD_MAX_ENTRIES,
      DEFAULTS.maxEntries,
      HARD_CAPS.maxEntries,
      "JYKSTORE_PAYLOAD_MAX_ENTRIES",
      warnings,
    ),
    maxUnpackedBytes: parsePositiveInt(
      env.JYKSTORE_PAYLOAD_MAX_UNPACKED_BYTES,
      DEFAULTS.maxUnpackedBytes,
      HARD_CAPS.maxUnpackedBytes,
      "JYKSTORE_PAYLOAD_MAX_UNPACKED_BYTES",
      warnings,
    ),
    maxSingleEntryBytes: parsePositiveInt(
      env.JYKSTORE_PAYLOAD_MAX_SINGLE_ENTRY_BYTES,
      DEFAULTS.maxSingleEntryBytes,
      HARD_CAPS.maxSingleEntryBytes,
      "JYKSTORE_PAYLOAD_MAX_SINGLE_ENTRY_BYTES",
      warnings,
    ),
    maxPathLength: parsePositiveInt(
      env.JYKSTORE_PAYLOAD_MAX_PATH_LENGTH,
      DEFAULTS.maxPathLength,
      HARD_CAPS.maxPathLength,
      "JYKSTORE_PAYLOAD_MAX_PATH_LENGTH",
      warnings,
    ),
    maxCompressionRatio: parsePositiveInt(
      env.JYKSTORE_PAYLOAD_MAX_COMPRESSION_RATIO,
      DEFAULTS.maxCompressionRatio,
      HARD_CAPS.maxCompressionRatio,
      "JYKSTORE_PAYLOAD_MAX_COMPRESSION_RATIO",
      warnings,
    ),
    compressionRatioMinUncompressedBytes: DEFAULTS.compressionRatioMinUncompressedBytes,
  };

  if (warnings.length > 0 && typeof console !== "undefined") {
    console.warn("[payload-limit-config]", warnings.join("; "));
  }

  return { config, warnings };
}

export function getPayloadLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
): PayloadLimitConfig {
  return resolvePayloadLimitConfig(env).config;
}
