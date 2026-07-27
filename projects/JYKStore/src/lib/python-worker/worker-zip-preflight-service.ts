/**
 * Admin 사전정리 — load Provider ZIP request bytes and build preflight inventory.
 */
import type { PrismaClient } from "@prisma/client";
import { PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import {
  getWorkerZipRequestBytes,
  getWorkerZipRequestMetadata,
  saveWorkerZipAdminPreflightExclusions,
} from "@/lib/python-worker/worker-zip-request-storage";
import {
  buildZipPreflightInventory,
  type ZipPreflightInventory,
} from "@/lib/python-worker/zip-preflight-inventory";

export class WorkerZipPreflightError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "WorkerZipPreflightError";
    this.code = code;
    this.status = status;
  }
}

async function resolveDraftPackVersion(
  packIdRaw: string,
  client: PrismaClient,
): Promise<{ packId: string; packName: string; versionId: string }> {
  const packId = packIdRaw.trim();
  if (!packId) {
    throw new WorkerZipPreflightError("PACK_ID_REQUIRED", "지식팩 ID가 필요합니다.", 400);
  }

  const pack = await client.knowledgePack.findFirst({
    where: { packId, status: { in: [PackStatus.DRAFT, PackStatus.REVIEWING] } },
    select: {
      packId: true,
      name: true,
      versions: {
        orderBy: latestKnowledgePackVersionOrderBy,
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!pack) {
    throw new WorkerZipPreflightError("PACK_NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  const version = pack.versions[0];
  if (!version) {
    throw new WorkerZipPreflightError(
      "VERSION_NOT_FOUND",
      "지식팩 버전이 없어 원본 ZIP을 조회할 수 없습니다.",
      404,
    );
  }
  return { packId: pack.packId, packName: pack.name, versionId: version.id };
}

export async function getAdminWorkerZipPreflightInventory(input: {
  packId: string;
  prismaClient?: PrismaClient;
  env?: NodeJS.ProcessEnv;
}): Promise<
  ZipPreflightInventory & {
    packId: string;
    packName: string;
    savedExcludedPaths: string[];
    savedExcludedReasons: Record<string, string>;
    savedExcludedAt: string | null;
  }
> {
  const client = input.prismaClient ?? prisma;
  const resolved = await resolveDraftPackVersion(input.packId, client);

  const [bytes, meta] = await Promise.all([
    getWorkerZipRequestBytes({
      packId: resolved.packId,
      packVersionId: resolved.versionId,
      env: input.env,
    }),
    getWorkerZipRequestMetadata({
      packId: resolved.packId,
      packVersionId: resolved.versionId,
      env: input.env,
    }).catch(() => null),
  ]);

  if (!bytes || bytes.byteLength === 0) {
    throw new WorkerZipPreflightError(
      "REQUEST_ZIP_NOT_FOUND",
      "원본 ZIP 자료를 찾을 수 없습니다. 제공자가 요청을 회수했거나 아직 업로드되지 않았습니다.",
      404,
    );
  }

  const inventory = await buildZipPreflightInventory(bytes, {
    originalFileName: meta?.originalFileName ?? null,
  });
  const saved = meta?.adminPreflightExclusions;
  const savedExcludedReasons: Record<string, string> = {};
  if (saved?.items?.length) {
    for (const item of saved.items) {
      if (item.path) savedExcludedReasons[item.path] = item.reason ?? "";
    }
  } else if (saved?.reasons) {
    Object.assign(savedExcludedReasons, saved.reasons);
  }

  return {
    packId: resolved.packId,
    packName: resolved.packName,
    ...inventory,
    savedExcludedPaths: saved?.paths ?? [],
    savedExcludedReasons,
    savedExcludedAt: saved?.savedAt ?? null,
  };
}

export async function saveAdminWorkerZipPreflightExclusions(input: {
  packId: string;
  paths?: readonly string[];
  items?: readonly { path: string; reason: string }[];
  adminUserId: string;
  prismaClient?: PrismaClient;
  env?: NodeJS.ProcessEnv;
}): Promise<{
  packId: string;
  savedExcludedPaths: string[];
  savedExcludedReasons: Record<string, string>;
  savedExcludedAt: string;
}> {
  const client = input.prismaClient ?? prisma;
  const resolved = await resolveDraftPackVersion(input.packId, client);

  const items =
    input.items ??
    (input.paths ?? []).map((path) => ({ path, reason: "" }));

  for (const item of items) {
    if (!item.path?.trim()) continue;
    if (!item.reason?.trim()) {
      throw new WorkerZipPreflightError(
        "EXCLUSION_REASON_REQUIRED",
        `제외사유가 필요합니다: ${item.path}`,
        400,
      );
    }
  }

  const updated = await saveWorkerZipAdminPreflightExclusions({
    packId: resolved.packId,
    packVersionId: resolved.versionId,
    items,
    savedByUserId: input.adminUserId,
    env: input.env,
  });
  if (!updated) {
    throw new WorkerZipPreflightError(
      "REQUEST_ZIP_NOT_FOUND",
      "원본 ZIP 요청 메타데이터가 없어 제외 선택을 저장할 수 없습니다.",
      404,
    );
  }
  const saved = updated.adminPreflightExclusions;
  const savedExcludedReasons: Record<string, string> = {};
  if (saved?.items) {
    for (const item of saved.items) {
      savedExcludedReasons[item.path] = item.reason;
    }
  }
  return {
    packId: resolved.packId,
    savedExcludedPaths: saved?.paths ?? [],
    savedExcludedReasons,
    savedExcludedAt: saved?.savedAt ?? new Date().toISOString(),
  };
}
