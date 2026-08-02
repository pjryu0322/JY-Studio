/**
 * Admin accept / resolve / reject on STORE_PROVIDER_SUPPLEMENT markers.
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

export async function acceptAdminProviderSupplement(input: {
  packId: string;
  clientId: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const run = await loadOpenSupplementRun(packId, client);
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_FOUND",
      message: "접수할 제공자 보완 요청이 없습니다.",
    };
  }
  if (run.status !== "PENDING") {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_PENDING",
      message: "접수 대기 상태의 요청만 접수할 수 있습니다.",
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
    adminPhase: "ACCEPTED",
    acceptedAt: now,
    acceptedByClientId: input.clientId,
    history: [
      ...state.history,
      { at: now, action: "ACCEPT", byRole: "ADMIN" },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: mapAdminPhaseToPipelineStatus("ACCEPTED"),
      summary: encodeProviderSupplementRequestState(next),
      triggeredByClientId: input.clientId,
    },
  });
  return { ok: true, state: next };
}

export async function resolveAdminProviderSupplement(input: {
  packId: string;
  clientId: string;
  resolutionNote: string;
  nextAdminStep?: "NONE" | "WORKER_REPROCESS" | "QUALITY_RECHECK";
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const note = input.resolutionNote?.trim() ?? "";
  if (!note) {
    return {
      ok: false,
      error: "RESOLUTION_NOTE_REQUIRED",
      message: "보완 처리 내용을 입력해 주세요.",
    };
  }
  const run = await loadOpenSupplementRun(packId, client);
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_FOUND",
      message: "처리할 제공자 보완 요청이 없습니다.",
    };
  }
  if (run.status !== "RUNNING" && run.status !== "WARNING") {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_RESOLVABLE",
      message: "접수 완료 후에만 보완 처리를 완료할 수 있습니다.",
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
    adminPhase: "RESOLVED",
    acceptedAt: state.acceptedAt ?? now,
    acceptedByClientId: state.acceptedByClientId ?? input.clientId,
    resolvedAt: now,
    resolutionNote: note,
    nextAdminStep: input.nextAdminStep ?? "NONE",
    history: [
      ...state.history,
      { at: now, action: "RESOLVE", byRole: "ADMIN", note: note.slice(0, 200) },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: mapAdminPhaseToPipelineStatus("RESOLVED"),
      finishedAt: new Date(),
      summary: encodeProviderSupplementRequestState(next),
      triggeredByClientId: input.clientId,
    },
  });
  return { ok: true, state: next };
}

export async function rejectAdminProviderSupplement(input: {
  packId: string;
  clientId: string;
  rejectionReason: string;
  prismaClient?: PrismaClientLike;
}): Promise<SupplementActionResult> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const reason = input.rejectionReason?.trim() ?? "";
  if (!reason) {
    return {
      ok: false,
      error: "REJECTION_REASON_REQUIRED",
      message: "반려 사유를 입력해 주세요.",
    };
  }
  const run = await loadOpenSupplementRun(packId, client);
  if (!run) {
    return {
      ok: false,
      error: "SUPPLEMENT_NOT_FOUND",
      message: "반려할 제공자 보완 요청이 없습니다.",
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
    adminPhase: "REJECTED",
    rejectedAt: now,
    rejectionReason: reason,
    history: [
      ...state.history,
      { at: now, action: "REJECT", byRole: "ADMIN", note: reason.slice(0, 200) },
    ],
  };
  await client.pipelineRun.update({
    where: { id: run.id },
    data: {
      status: mapAdminPhaseToPipelineStatus("REJECTED"),
      finishedAt: new Date(),
      summary: encodeProviderSupplementRequestState(next),
      triggeredByClientId: input.clientId,
    },
  });
  return { ok: true, state: next };
}
