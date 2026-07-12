import type { KnowledgePayload, PackDistributionMetadata, Prisma } from "@prisma/client";
import {
  buildDistributionManifest,
  isDistributionVisibility,
  type DistributionManifest,
} from "@/lib/distribution/payload-manifest";
import {
  DISTRIBUTION_MANIFEST_SCHEMA_VERSION,
  DISTRIBUTION_MANIFEST_READABLE_SCHEMA_VERSIONS,
} from "@/lib/distribution/payload-types";
import { sha256Hex } from "@/lib/distribution/payload-checksum";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";

export type ManifestFingerprintPayload = Omit<DistributionManifest, "createdAt">;

export function stableManifestFingerprint(manifest: DistributionManifest): string {
  const { createdAt, ...rest } = manifest;
  void createdAt;
  return sha256Hex(new TextEncoder().encode(stableStringify(rest)));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export async function refreshDistributionManifest(input: {
  packId: string;
  versionId: string;
  reason: string;
}): Promise<DistributionManifest | null> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    include: { providerProfile: true },
  });
  if (!pack) return null;

  const version = await prisma.knowledgePackVersion.findFirst({
    where: { id: input.versionId, packId: input.packId },
    include: { payload: true, distributionMetadata: true },
  });
  if (!version?.payload) return null;

  const payload = version.payload;
  const meta = version.distributionMetadata;
  const providerId = pack.providerProfileId ?? pack.providerProfile?.id ?? "unknown";
  const displayName =
    pack.providerName || pack.providerProfile?.displayName || "Provider";

  const manifest = buildDistributionManifest({
    pack: {
      packId: pack.packId,
      versionId: version.id,
      name: pack.name,
      version: version.version,
    },
    provider: {
      providerId,
      displayName,
    },
    generator: {
      type: payload.generatorType as "DOCLING" | "UNSTRUCTURED",
      version: payload.generatorVersion,
    },
    payload: {
      payloadId: payload.id,
      profile: payload.profile as "docling-chunks-v1" | "unstructured-elements-v1",
      originalFileName: payload.originalFileName,
      mimeType: payload.mimeType,
      fileSize: Number(payload.fileSize),
      checksumSha256: payload.checksumSha256,
    },
    source: {
      title: meta?.sourceTitle ?? null,
      url: meta?.sourceUrl ?? null,
      licenseName: meta?.licenseName ?? "UNSPECIFIED",
    },
    distribution: {
      visibility: (meta?.visibility ?? "PRIVATE") as "PRIVATE" | "PUBLIC" | "UNLISTED",
      allowDownload: meta?.allowDownload ?? true,
    },
  });

  await prisma.knowledgePayload.update({
    where: { id: payload.id },
    data: { manifestJson: manifest as unknown as Prisma.InputJsonValue },
  });

  return manifest;
}

export type CurrentDistributionManifestState = {
  manifest: DistributionManifest;
  fingerprint: string;
  payload: KnowledgePayload;
  distribution: PackDistributionMetadata | null;
};

export async function getCurrentDistributionManifestState(input: {
  packId: string;
  versionId: string;
  payloadId?: string;
}): Promise<CurrentDistributionManifestState | null> {
  const manifest = await refreshDistributionManifest({
    packId: input.packId,
    versionId: input.versionId,
    reason: "current_state",
  });
  if (!manifest) return null;

  const version = await prisma.knowledgePackVersion.findFirst({
    where: { id: input.versionId, packId: input.packId },
    include: { payload: true, distributionMetadata: true },
  });
  if (!version?.payload) return null;
  if (input.payloadId && version.payload.id !== input.payloadId) return null;

  return {
    manifest,
    fingerprint: stableManifestFingerprint(manifest),
    payload: version.payload,
    distribution: version.distributionMetadata,
  };
}

export function assertManifestIntegrity(input: {
  manifest: DistributionManifest;
  payloadId: string;
  packId: string;
  versionId: string;
  checksumSha256: string;
  fileSize?: number;
  profile?: string;
}): { ok: true } | { ok: false; code: "MANIFEST_STALE" | "MANIFEST_INTEGRITY_FAILED"; message: string } {
  if (input.manifest.schemaVersion !== DISTRIBUTION_MANIFEST_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "MANIFEST_INTEGRITY_FAILED",
      message: "Manifest schemaVersion이 올바르지 않습니다. 0.2로 재생성하세요.",
    };
  }
  if (input.manifest.pack.packId !== input.packId) {
    return {
      ok: false,
      code: "MANIFEST_INTEGRITY_FAILED",
      message: "Manifest packId가 일치하지 않습니다.",
    };
  }
  if (input.manifest.pack.versionId !== input.versionId) {
    return {
      ok: false,
      code: "MANIFEST_STALE",
      message: "Manifest versionId가 일치하지 않습니다.",
    };
  }
  if (input.manifest.payload.payloadId !== input.payloadId) {
    return {
      ok: false,
      code: "MANIFEST_STALE",
      message: "Manifest payloadId가 일치하지 않습니다.",
    };
  }
  if (input.manifest.payload.checksumSha256 !== input.checksumSha256) {
    return {
      ok: false,
      code: "MANIFEST_STALE",
      message: "Manifest checksum이 Payload와 일치하지 않습니다.",
    };
  }
  if (
    typeof input.fileSize === "number" &&
    input.manifest.payload.fileSize !== input.fileSize
  ) {
    return {
      ok: false,
      code: "MANIFEST_STALE",
      message: "Manifest fileSize가 Payload와 일치하지 않습니다.",
    };
  }
  if (typeof input.profile === "string" && input.manifest.payload.profile !== input.profile) {
    return {
      ok: false,
      code: "MANIFEST_STALE",
      message: "Manifest profile이 Payload와 일치하지 않습니다.",
    };
  }
  if (!input.manifest.source.licenseName?.trim()) {
    return {
      ok: false,
      code: "MANIFEST_INTEGRITY_FAILED",
      message: "Manifest에 라이선스가 없습니다.",
    };
  }
  if (!input.manifest.source.title && !input.manifest.source.url) {
    return {
      ok: false,
      code: "MANIFEST_INTEGRITY_FAILED",
      message: "Manifest에 출처 정보가 없습니다.",
    };
  }
  if (!isDistributionVisibility(input.manifest.distribution.visibility)) {
    return {
      ok: false,
      code: "MANIFEST_INTEGRITY_FAILED",
      message: "Manifest visibility가 올바르지 않습니다.",
    };
  }
  if (typeof input.manifest.distribution.allowDownload !== "boolean") {
    return {
      ok: false,
      code: "MANIFEST_INTEGRITY_FAILED",
      message: "Manifest allowDownload가 올바르지 않습니다.",
    };
  }
  return { ok: true };
}

export function isReadableManifestSchemaVersion(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (DISTRIBUTION_MANIFEST_READABLE_SCHEMA_VERSIONS as readonly string[]).includes(value)
  );
}

export function createPayloadId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}
