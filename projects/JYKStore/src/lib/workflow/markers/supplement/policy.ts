/**
 * Shared loaders / predicates for STORE_PROVIDER_SUPPLEMENT markers.
 */
import { STORE_PROVIDER_SUPPLEMENT_TRIGGER } from "@/lib/provider-supplement-request";
import type { PrismaClientLike } from "./types";

export async function loadOpenSupplementRun(
  packId: string,
  client: PrismaClientLike,
): Promise<{
  id: string;
  status: string;
  summary: string | null;
} | null> {
  return client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
      status: { in: ["PENDING", "RUNNING", "WARNING"] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, summary: true },
  });
}
