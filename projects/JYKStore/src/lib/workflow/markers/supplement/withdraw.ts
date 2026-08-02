/**
 * Provider withdraw of a PENDING STORE_PROVIDER_SUPPLEMENT request.
 */

import { prisma } from "@/lib/prisma";
import {
  STORE_PROVIDER_SUPPLEMENT_TRIGGER,
  encodeProviderSupplementRequestState,
  mapAdminPhaseToPipelineStatus,
  parseProviderSupplementRequestState,
  type ProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import type { PrismaClientLike, SupplementActionResult } from "./types";

export async function withdrawProviderSupplementRequest(input: {
  packId: string;
  clientId: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const run = await client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: STORE_PROVIDER_SUPPLEMENT_TRIGGER,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, summary: true },
  });
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_WITHDRAWABLE",
      message: "접수 대기 중인 보완 요청만 철회할 수 있습니다.",
    };
  }
  const state = parseProviderSupplementRequestState(run.summary);
  if (!state) {
    return {
      ok: false,
      error: "SUPPLEMENT_INVALID",
      message: "보완 요청 데이터가 올바르지 않습니다.",
    };
  }
  const now = new Date().toISOString();
  const next: ProviderSupplementRequestState = {
    ...state,
    adminPhase: "WITHDRAWN",
    history: [
      ...state.history,
      { at: now, action: "WITHDRAW", byRole: "PROVIDER" },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: mapAdminPhaseToPipelineStatus("WITHDRAWN"),
      finishedAt: new Date(),
      summary: encodeProviderSupplementRequestState(next),
    },
  });
  return { ok: true, state: next };
}
