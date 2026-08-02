/**
 * After admin resolves a provider 보완요청, re-open provider review handoff
 * so the provider can confirm the fixed generation result.
 */

import { prisma } from "@/lib/prisma";
import {
  STORE_PROVIDER_SUPPLEMENT_TRIGGER,
  encodeProviderSupplementRequestState,
  parseProviderSupplementRequestState,
  type ProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import { requestProviderStoreReview } from "../provider-review";
import type { PrismaClientLike, SupplementActionResult } from "./types";

export async function requestProviderReviewAgainAfterSupplement(input: {
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
      status: "PASS",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, summary: true },
  });
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_RESOLVED",
      message: "보완 완료된 요청만 제공자 재검토를 요청할 수 있습니다.",
    };
  }
  const state = parseProviderSupplementRequestState(run.summary);
  if (!state || state.adminPhase !== "RESOLVED") {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_RESOLVED",
      message: "보완 완료된 요청만 제공자 재검토를 요청할 수 있습니다.",
    };
  }

  const reviewResult = await requestProviderStoreReview({
    packId,
    clientId: input.clientId,
    prismaClient: client,
  });
  if (!reviewResult.ok) {
    return {
      ok: false,
      error: reviewResult.error,
      message: reviewResult.message,
    };
  }

  const now = new Date().toISOString();
  const next: ProviderSupplementRequestState = {
    ...state,
    history: [
      ...state.history,
      {
        at: now,
        action: "REQUEST_REVIEW_AGAIN",
        byRole: "ADMIN",
        note: "제공자 재검토 요청",
      },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      summary: encodeProviderSupplementRequestState(next),
      triggeredByClientId: input.clientId,
    },
  });
  return { ok: true, state: next };
}
