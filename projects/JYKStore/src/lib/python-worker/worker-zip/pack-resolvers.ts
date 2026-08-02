import { PackStatus } from "@prisma/client";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { prisma } from "@/lib/prisma";
import { WorkerZipImportServiceError } from "./errors";

export type ResolvedWorkerZipPack = {
  pack: { packId: string; name: string; status: PackStatus };
  version: { id: string; version: string; language: string | null };
};

export type WorkerZipPackResolver = (
  client: typeof prisma,
  input: { userId: string; clientId: string; packId: string },
) => Promise<ResolvedWorkerZipPack>;

export async function requireOwnedDraftPack(
  client: typeof prisma,
  findProfile: (userId: string, clientId: string) => Promise<{ id: string } | null>,
  input: { userId: string; clientId: string; packId: string },
) {
  const profile = await findProfile(input.userId, input.clientId);
  if (!profile) {
    throw new WorkerZipImportServiceError("PROFILE_REQUIRED", "제공자 프로필이 필요합니다.", 403);
  }
  const pack = await client.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: profile.id },
    include: { versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 } },
  });
  if (!pack) {
    throw new WorkerZipImportServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  if (pack.status !== PackStatus.DRAFT) {
    throw new WorkerZipImportServiceError(
      "PACK_NOT_EDITABLE",
      "초안(DRAFT) 상태에서만 데이터 구조화를 실행할 수 있습니다.",
      409,
    );
  }
  const version = pack.versions[0];
  if (!version) {
    throw new WorkerZipImportServiceError("INCOMPLETE", "버전이 없습니다.", 400);
  }
  return { pack, version };
}

/**
 * P7.3: Admin pack resolver — finds a DRAFT pack by packId regardless of which
 * provider owns it. Used by the Admin execute route (which is already gated by
 * `requireAdminSession`); the operator does not need the provider's profile.
 */
export const resolveAdminDraftPack: WorkerZipPackResolver = async (client, input) => {
  const pack = await client.knowledgePack.findFirst({
    where: { packId: input.packId },
    include: { versions: { orderBy: latestKnowledgePackVersionOrderBy, take: 1 } },
  });
  if (!pack) {
    throw new WorkerZipImportServiceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.", 404);
  }
  if (pack.status !== PackStatus.DRAFT) {
    throw new WorkerZipImportServiceError(
      "PACK_NOT_EDITABLE",
      "초안(DRAFT) 상태의 요청만 지식데이터 생성을 실행할 수 있습니다.",
      409,
    );
  }
  const version = pack.versions[0];
  if (!version) {
    throw new WorkerZipImportServiceError("INCOMPLETE", "버전이 없습니다.", 400);
  }
  return { pack, version };
};
