import {
  DISTRIBUTION_MANIFEST_SCHEMA_VERSION,
  DISTRIBUTION_VISIBILITIES,
  type DistributionVisibility,
  type PayloadGeneratorType,
  type PayloadProfile,
} from "@/lib/distribution/payload-types";

export type DistributionManifestInput = {
  pack: {
    packId: string;
    versionId: string;
    name: string;
    version: string;
  };
  provider: {
    providerId: string;
    displayName: string;
  };
  generator: {
    type: PayloadGeneratorType;
    version?: string | null;
  };
  payload: {
    payloadId: string;
    profile: PayloadProfile;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    checksumSha256: string;
  };
  source: {
    title?: string | null;
    url?: string | null;
    licenseName: string;
  };
  distribution: {
    visibility: DistributionVisibility;
    allowDownload: boolean;
  };
  createdAt?: string | Date;
};

export type DistributionManifest = {
  schemaVersion: typeof DISTRIBUTION_MANIFEST_SCHEMA_VERSION;
  pack: {
    packId: string;
    versionId: string;
    name: string;
    version: string;
  };
  provider: {
    providerId: string;
    displayName: string;
  };
  generator: {
    type: PayloadGeneratorType;
    version?: string;
  };
  payload: {
    payloadId: string;
    profile: PayloadProfile;
    originalFileName: string;
    mimeType: string;
    fileSize: number;
    checksumSha256: string;
  };
  source: {
    title?: string;
    url?: string;
    licenseName: string;
  };
  distribution: {
    visibility: DistributionVisibility;
    allowDownload: boolean;
  };
  createdAt: string;
};

function toIso(value: string | Date | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return new Date().toISOString();
}

/**
 * Build a distribution manifest for DB/storage packaging (schema 0.2).
 * Never includes internal storagePath, clientId, API keys, or audit details.
 */
export function buildDistributionManifest(
  input: DistributionManifestInput,
): DistributionManifest {
  const generator: DistributionManifest["generator"] = {
    type: input.generator.type,
  };
  if (input.generator.version != null && input.generator.version !== "") {
    generator.version = input.generator.version;
  }

  const source: DistributionManifest["source"] = {
    licenseName: input.source.licenseName,
  };
  if (input.source.title) source.title = input.source.title;
  if (input.source.url) source.url = input.source.url;

  return {
    schemaVersion: DISTRIBUTION_MANIFEST_SCHEMA_VERSION,
    pack: {
      packId: input.pack.packId,
      versionId: input.pack.versionId,
      name: input.pack.name,
      version: input.pack.version,
    },
    provider: {
      providerId: input.provider.providerId,
      displayName: input.provider.displayName,
    },
    generator,
    payload: {
      payloadId: input.payload.payloadId,
      profile: input.payload.profile,
      originalFileName: input.payload.originalFileName,
      mimeType: input.payload.mimeType,
      fileSize: input.payload.fileSize,
      checksumSha256: input.payload.checksumSha256,
    },
    source,
    distribution: {
      visibility: input.distribution.visibility,
      allowDownload: input.distribution.allowDownload,
    },
    createdAt: toIso(input.createdAt),
  };
}

export function isDistributionVisibility(value: unknown): value is DistributionVisibility {
  return (
    typeof value === "string" &&
    (DISTRIBUTION_VISIBILITIES as readonly string[]).includes(value)
  );
}
