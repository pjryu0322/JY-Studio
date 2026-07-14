/** Shared types for distribution metadata and ZIP reading (OpenXML / legacy zip tools). */

export const DISTRIBUTION_VISIBILITIES = ["PRIVATE", "PUBLIC", "UNLISTED"] as const;
export type DistributionVisibility = (typeof DISTRIBUTION_VISIBILITIES)[number];

/** Retained for historical DISTRIBUTION submit snapshot parsing. */
export const DISTRIBUTION_MANIFEST_SCHEMA_VERSION = "jyk-distribution-0.2" as const;
export const DISTRIBUTION_MANIFEST_SCHEMA_VERSION_V1 = "jyk-distribution-0.1" as const;
export const DISTRIBUTION_MANIFEST_READABLE_SCHEMA_VERSIONS = [
  DISTRIBUTION_MANIFEST_SCHEMA_VERSION_V1,
  DISTRIBUTION_MANIFEST_SCHEMA_VERSION,
] as const;

/** 50 MB compressed ZIP read limit (OpenXML / zip reader). */
export const PAYLOAD_MAX_ZIP_BYTES = 50 * 1024 * 1024;
/** Maximum number of ZIP entries (files + directories). */
export const PAYLOAD_MAX_ENTRIES = 5_000;
/** 200 MB total uncompressed size across all entries. */
export const PAYLOAD_MAX_UNPACKED_BYTES = 200 * 1024 * 1024;
/** 50 MB maximum for any single uncompressed entry. */
export const PAYLOAD_MAX_SINGLE_ENTRY_BYTES = 50 * 1024 * 1024;
/** Maximum path length for a ZIP entry name. */
export const PAYLOAD_MAX_PATH_LENGTH = 300;

/** Executable / script extensions rejected inside ZIPs. */
export const PAYLOAD_FORBIDDEN_EXTENSIONS = [
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".com",
  ".scr",
  ".jar",
] as const;

export type PayloadZipEntry = {
  path: string;
  uncompressedSize: number;
};
