/** Shared types and limits for immutable knowledge payload distribution (P29). */

export const PAYLOAD_PROFILES = ["docling-chunks-v1", "unstructured-elements-v1"] as const;
export type PayloadProfile = (typeof PAYLOAD_PROFILES)[number];

export const PAYLOAD_GENERATOR_TYPES = ["DOCLING", "UNSTRUCTURED"] as const;
export type PayloadGeneratorType = (typeof PAYLOAD_GENERATOR_TYPES)[number];

export const PAYLOAD_VALIDATION_STATUSES = ["PENDING", "VALID", "INVALID"] as const;
export type PayloadValidationStatus = (typeof PAYLOAD_VALIDATION_STATUSES)[number];

export const DISTRIBUTION_VISIBILITIES = ["PRIVATE", "PUBLIC", "UNLISTED"] as const;
export type DistributionVisibility = (typeof DISTRIBUTION_VISIBILITIES)[number];

export const DISTRIBUTION_MANIFEST_SCHEMA_VERSION = "jyk-distribution-0.1" as const;

/** 50 MB compressed ZIP upload limit. */
export const PAYLOAD_MAX_ZIP_BYTES = 50 * 1024 * 1024;
/** Maximum number of ZIP entries (files + directories). */
export const PAYLOAD_MAX_ENTRIES = 5_000;
/** 200 MB total uncompressed size across all entries. */
export const PAYLOAD_MAX_UNPACKED_BYTES = 200 * 1024 * 1024;
/** 50 MB maximum for any single uncompressed entry. */
export const PAYLOAD_MAX_SINGLE_ENTRY_BYTES = 50 * 1024 * 1024;
/** Maximum path length for a ZIP entry name. */
export const PAYLOAD_MAX_PATH_LENGTH = 300;

export const PAYLOAD_ALLOWED_EXTENSIONS = [".zip"] as const;
export const PAYLOAD_ALLOWED_MIME_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
] as const;

/** Executable / script extensions rejected inside payload ZIPs. */
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

export type PayloadForbiddenExtension = (typeof PAYLOAD_FORBIDDEN_EXTENSIONS)[number];

export type PayloadZipEntry = {
  path: string;
  uncompressedSize: number;
};

export type PayloadZipValidationResult = {
  ok: boolean;
  entries: PayloadZipEntry[];
  errors: string[];
};

export type PayloadProfileValidationResult = {
  ok: boolean;
  entrypoint?: string;
  recordCount?: number;
  warnings: string[];
  errors: string[];
};

export type PayloadProfileValidateInput = {
  zipEntries: PayloadZipEntry[];
  /** When provided, validators may load entrypoint content from the ZIP. */
  zipBytes?: Uint8Array;
};

export interface PayloadProfileValidator {
  readonly profile: PayloadProfile;
  validate(input: PayloadProfileValidateInput): Promise<PayloadProfileValidationResult>;
}

export function isPayloadProfile(value: string): value is PayloadProfile {
  return (PAYLOAD_PROFILES as readonly string[]).includes(value);
}

export function isPayloadGeneratorType(value: string): value is PayloadGeneratorType {
  return (PAYLOAD_GENERATOR_TYPES as readonly string[]).includes(value);
}

export function profileForGenerator(generatorType: PayloadGeneratorType): PayloadProfile {
  switch (generatorType) {
    case "DOCLING":
      return "docling-chunks-v1";
    case "UNSTRUCTURED":
      return "unstructured-elements-v1";
  }
}

export function generatorForProfile(profile: PayloadProfile): PayloadGeneratorType {
  switch (profile) {
    case "docling-chunks-v1":
      return "DOCLING";
    case "unstructured-elements-v1":
      return "UNSTRUCTURED";
  }
}
