/**
 * Provider note on an open STORE_PROVIDER_SUPPLEMENT marker.
 */

import { prisma } from "@/lib/prisma";
import {
  encodeProviderSupplementRequestState,
  parseProviderSupplementRequestState,
  type ProviderSupplementRequestState,
} from "@/lib/provider-supplement-request";
import { loadOpenSupplementRun } from "./policy";
import type { PrismaClientLike, SupplementActionResult } from "./types";

export async function addProviderSupplementNote(input: {
  packId: string;
  clientId: string;
  note: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const text = input.note?.trim() ?? "";
  if (!text) {
    return {
      ok: false,
      error: "NOTE_REQUIRED",
      message: "추가 의견을 입력해 주세요.",
    };
  }
  const run = await loadOpenSupplementRun(packId, client);
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_FOUND",
      message: "의견을 남길 보완 요청이 없습니다.",
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
    providerNotes: [
      ...state.providerNotes,
      { at: now, text, clientId: input.clientId },
    ],
    history: [
      ...state.history,
      { at: now, action: "NOTE", byRole: "PROVIDER", note: text.slice(0, 200) },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: { summary: encodeProviderSupplementRequestState(next) },
  });
  return { ok: true, state: next };
}
