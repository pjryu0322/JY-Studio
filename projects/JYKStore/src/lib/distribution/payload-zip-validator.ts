import { getPayloadLimitConfig } from "@/lib/distribution/payload-limit-config";
import {
  validateZipAndReadSelectedEntries,
  type ZipCentralEntry,
} from "@/lib/distribution/payload-zip-reader";
import type {
  PayloadZipEntry,
  PayloadZipValidationResult,
} from "@/lib/distribution/payload-types";

export { findUnsafeZipPathReason } from "@/lib/distribution/payload-zip-path";

export type ValidateZipBytesOptions = {
  maxZipBytes?: number;
  maxEntries?: number;
  maxUnpackedBytes?: number;
  maxSingleEntryBytes?: number;
  maxPathLength?: number;
  maxCompressionRatio?: number;
};

/**
 * Validate ZIP bytes for upload safety using central-directory metadata (yauzl).
 */
export async function validateZipBytes(
  bytes: Uint8Array,
  options: ValidateZipBytesOptions = {},
): Promise<PayloadZipValidationResult> {
  const base = getPayloadLimitConfig();
  const result = await validateZipAndReadSelectedEntries(bytes, [], {
    maxZipBytes: options.maxZipBytes ?? base.maxZipBytes,
    maxEntries: options.maxEntries ?? base.maxEntries,
    maxUnpackedBytes: options.maxUnpackedBytes ?? base.maxUnpackedBytes,
    maxSingleEntryBytes: options.maxSingleEntryBytes ?? base.maxSingleEntryBytes,
    maxPathLength: options.maxPathLength ?? base.maxPathLength,
    maxCompressionRatio: options.maxCompressionRatio ?? base.maxCompressionRatio,
    compressionRatioMinUncompressedBytes: base.compressionRatioMinUncompressedBytes,
  });

  const entries: PayloadZipEntry[] = result.entries.map((e: ZipCentralEntry) => ({
    path: e.path,
    uncompressedSize: e.uncompressedSize,
  }));

  return {
    ok: result.ok,
    entries,
    errors: result.errors,
  };
}
