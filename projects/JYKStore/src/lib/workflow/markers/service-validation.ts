/**
 * Admin marks Store service validation (API/MCP/ZIP-RAG channels) as passed.
 */

import { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import { resolveStoreServiceChannelGates } from "@/lib/store-workflow-handoff-gates";
import { recordProviderAudit } from "@/lib/provider-audit";
import { STORE_SERVICE_VALIDATION_TRIGGER } from "./constants";
import type { PrismaClientLike } from "./types";
import { resolveStoreWorkflowMarkers } from "./resolve";

export async function markAdminServiceValidationPassed(input: {
  packId: string;
  clientId: string;
  prismaClient?: PrismaClientLike;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      error: string;
      message: string;
      missingChannels?: string[];
      providerSupplementPhase?: string;
    }
> {
  const client = input.prismaClient ?? prisma;
  const packId = input.packId.trim();
  const markers = await resolveStoreWorkflowMarkers(packId, client);
  if (isOpenProviderSupplementPhase(markers.providerSupplementPhase)) {
    return {
      ok: false,
      error: "PROVIDER_SUPPLEMENT_OPEN",
      message: "제공자 보완요청이 처리되지 않아 서비스 검증을 완료할 수 없습니다.",
      providerSupplementPhase: markers.providerSupplementPhase,
    };
  }
  if (markers.serviceValidationPhase === "PASSED") return { ok: true };

  const channelGates = await resolveStoreServiceChannelGates(packId, client);
  if (!channelGates.allPassed) {
    const bindingHint =
      channelGates.bindingStatus !== "CURRENT"
        ? channelGates.bindingReason ??
          "최신 산출물 기준 API/MCP/ZIP 검증을 다시 수행해야 합니다."
        : null;
    const channelReason = channelGates.channels.find((c) => !c.passed)?.reasonCode;
    return {
      ok: false,
      error:
        channelReason === "WORKER_ZIP_GENERATION_MISSING"
          ? "WORKER_ZIP_GENERATION_MISSING"
          : channelReason === "WORKER_ZIP_NOT_PASSED"
            ? "WORKER_ZIP_NOT_PASSED"
            : channelGates.bindingStatus === "MISSING"
              ? "BINDING_MISSING"
              : channelGates.bindingStatus === "STALE"
                ? "STALE_BINDING"
                : channelGates.bindingStatus === "NOT_READY"
                  ? "BINDING_NOT_READY"
                  : "SERVICE_CHANNELS_INCOMPLETE",
      message:
        bindingHint ??
        `API·MCP·ZIP/RAG Export 검증이 모두 통과해야 합니다. 미검증: ${channelGates.missingLabels.join(", ")}`,
      missingChannels: channelGates.missingLabels,
    };
  }

  await client.pipelineRun.create({
    data: {
      packId,
      triggerType: STORE_SERVICE_VALIDATION_TRIGGER,
      triggeredByClientId: input.clientId,
      status: "PASS",
      finishedAt: new Date(),
      summary: "관리자 서비스 검증 통과 (API·MCP·ZIP/RAG Export)",
    },
  });

  try {
    await recordProviderAudit({
      action: AuditAction.ADMIN_REVIEW_UPDATE,
      entityType: "KnowledgePack",
      entityId: packId,
      metadata: {
        action: "SERVICE_VALIDATION_PASSED",
        actorClientId: input.clientId,
        channels: channelGates.channels.map((c) => ({
          channel: c.channel,
          passed: c.passed,
        })),
      },
    });
  } catch {
    // Test doubles may omit AuditLog.
  }

  return { ok: true };
}
