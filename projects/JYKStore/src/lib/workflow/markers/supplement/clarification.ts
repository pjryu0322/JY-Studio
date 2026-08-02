/**
 * Admin clarify action on STORE_PROVIDER_SUPPLEMENT markers.
 */

import { prisma } from "@/lib/prisma";
import {
  encodeProviderSupplementRequestState,
  mapAdminPhaseToPipelineStatus,
  parseProviderSupplementRequestState,
  type ProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import { loadOpenSupplementRun } from "./policy";
import type { PrismaClientLike, SupplementActionResult } from "./types";

export async function clarifyAdminProviderSupplement(input: {
  packId: string;
  clientId: string;
  clarifyMessage: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const message = input.clarifyMessage?.trim() ?? "";
  if (!message) {
    return {
      ok: false,
      error: "CLARIFY_MESSAGE_REQUIRED",
      message: "추가 확인 요청 내용을 입력해 주세요.",
    };
  }
  const run = await loadOpenSupplementRun(packId, client);
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_FOUND",
      message: "추가 확인을 요청할 보완 요청이 없습니다.",
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
    adminPhase: "CLARIFY",
    acceptedAt: state.acceptedAt ?? now,
    acceptedByClientId: state.acceptedByClientId ?? input.clientId,
    clarifyAt: now,
    clarifyMessage: message,
    history: [
      ...state.history,
      {
        at: now,
        action: "CLARIFY",
        byRole: "ADMIN",
        note: message.slice(0, 200),
      },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: mapAdminPhaseToPipelineStatus("CLARIFY"),
      summary: encodeProviderSupplementRequestState(next),
      triggeredByClientId: input.clientId,
    },
  });
  return { ok: true, state: next };
}
