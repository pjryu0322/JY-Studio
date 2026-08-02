/**
 * Admin/provider actions on STORE_PROVIDER_SUPPLEMENT (제공자 보완요청) markers.
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
import { requestProviderStoreReview } from "./provider-review";

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

/**
 * After admin resolves a provider 보완요청, re-open provider review handoff
 * so the provider can confirm the fixed generation result.
 */
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
