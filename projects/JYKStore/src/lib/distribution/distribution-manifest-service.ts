import type { Prisma } from "@prisma/client";
import { buildDistributionManifest, type DistributionManifest } from "@/lib/distribution/payload-manifest";
import { DISTRIBUTION_MANIFEST_SCHEMA_VERSION } from "@/lib/distribution/payload-types";
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

export function assertManifestIntegrity(input: {
  manifest: DistributionManifest;
  payloadId: string;
  packId: string;
  versionId: string;
  checksumSha256: string;
}): { ok: true } | { ok: false; code: "MANIFEST_STALE" | "MANIFEST_INTEGRITY_FAILED"; message: string } {
  if (input.manifest.schemaVersion !== DISTRIBUTION_MANIFEST_SCHEMA_VERSION) {
    return {
      ok: false,
      code: "MANIFEST_INTEGRITY_FAILED",
      message: "Manifest schemaVersion이 올바르지 않습니다.",
    };
  }
  if (input.manifest.pack.packId !== input.packId) {
    return {
      ok: false,
      code: "MANIFEST_INTEGRITY_FAILED",
      message: "Manifest packId가 일치하지 않습니다.",
    };
  }
  if (input.manifest.payload.checksumSha256 !== input.checksumSha256) {
    return {
      ok: false,
      code: "MANIFEST_STALE",
      message: "Manifest checksum이 Payload와 일치하지 않습니다.",
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
  void input.payloadId;
  void input.versionId;
  return { ok: true };
}

export function createPayloadId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}
