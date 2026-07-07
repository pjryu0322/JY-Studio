import { PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Public API(외부 AI/Agent/플랫폼 호출용)에서 노출 가능한 pack 상태.
// Retrieval API의 published status 기준과 동일하게 유지한다.
export const PUBLIC_PACK_STATUSES = [PackStatus.PUBLISHED, PackStatus.VERIFIED] as const;

export async function isPublicKnowledgePack(packId: string): Promise<boolean> {
  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId,
      status: { in: [...PUBLIC_PACK_STATUSES] },
    },
    select: { packId: true },
  });
  return Boolean(pack);
}
