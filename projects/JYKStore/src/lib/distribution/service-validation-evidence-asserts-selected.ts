/**
 * Fail-closed assertions that gate submit on selected distribution-channel
 * service validation evidence.
 */
import type { PackDistributionMetadata } from "@prisma/client";
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import {
  assertDistributionChannelsSelected,
  selectedServiceChannels,
  type ServiceChannel,
} from "@/lib/distribution/service-channel-policy";
import { prisma } from "@/lib/prisma";
import { resolveConfirmationStatusDto } from "@/lib/distribution/service-validation-policy";
import { findLatestServiceValidationRun } from "@/lib/distribution/service-validation-queries";
import {
  assertDownloadTestEvidenceReady,
  assertSharedApiMcpConfirmationEvidenceIfGrouped,
} from "@/lib/distribution/service-validation-evidence-asserts-helpers";
import {
  resolvePreparationChannelValidity,
  type ServiceValidationSubmitSnapshotEntry,
} from "@/lib/distribution/service-validation-evidence-asserts-preparation";

/** Pure: throws unless the selected-channel run PASSed and is CURRENT. */
function assertSelectedChannelRunPassCurrent(
  run: Awaited<ReturnType<typeof findLatestServiceValidationRun>>,
  validity: "CURRENT" | "STALE",
  channel: ServiceChannel,
): asserts run is NonNullable<Awaited<ReturnType<typeof findLatestServiceValidationRun>>> {
  if (run && run.status === "PASS" && validity === "CURRENT") return;
  throw new PayloadServiceError(
    validity === "STALE" || run?.status === "STALE"
      ? "SERVICE_VALIDATION_STALE"
      : "SERVICE_VALIDATION_REQUIRED",
    validity === "STALE"
      ? "지식 데이터 또는 유통정보가 변경되어 서비스 검증을 다시 진행해야 합니다."
      : `선택한 ${channel} 제공 방식의 검증이 필요합니다.`,
    400,
  );
}

/** Pure: throws when a selected API/MCP channel has no retrieval result-item snapshot. */
function assertSelectedChannelResultsNonEmpty(
  channel: ServiceChannel,
  resultItemCount: number | null,
): void {
  if ((channel === "API" || channel === "MCP") && (resultItemCount ?? 0) < 1) {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_RESULT_SNAPSHOT_EMPTY",
      `선택한 ${channel} 제공 방식의 검색 결과 Snapshot이 없습니다. 다시 검증해 주세요.`,
      400,
    );
  }
}

/** DB + pure: resolves the provider confirmation for a selected channel, or throws. */
async function loadSelectedChannelConfirmation(input: {
  runId: string;
  validity: "CURRENT" | "STALE";
  channel: ServiceChannel;
}) {
  const confirmation = await prisma.serviceValidationProviderConfirmation.findUnique({
    where: { runId: input.runId },
  });
  const confStatus = resolveConfirmationStatusDto({
    confirmationStatus: confirmation?.status,
    runValidity: input.validity,
  });
  if (confStatus !== "CONFIRMED" || !confirmation) {
    throw new PayloadServiceError(
      confStatus === "STALE"
        ? "SERVICE_VALIDATION_STALE"
        : confStatus === "REJECTED"
          ? "SERVICE_CONFIRMATION_REJECTED"
          : "SERVICE_CONFIRMATION_REQUIRED",
      confStatus === "REJECTED"
        ? `선택한 ${input.channel} 제공 방식의 검색 품질이 반려되었습니다. 다시 검증해 주세요.`
        : confStatus === "STALE"
          ? "지식 데이터 또는 유통정보가 변경되어 서비스 품질 확인을 다시 진행해야 합니다."
          : `선택한 ${input.channel} 제공 방식의 제공자 품질 확인이 필요합니다.`,
      400,
    );
  }
  return { confirmation, confStatus };
}

/** Full evidence gate for one selected distribution channel. */
async function assertSelectedChannelPassed(input: {
  versionId: string;
  channel: ServiceChannel;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): Promise<ServiceValidationSubmitSnapshotEntry> {
  const { channel } = input;
  const run = await findLatestServiceValidationRun({ versionId: input.versionId, channel });
  const resultItemCount =
    run && (channel === "API" || channel === "MCP")
      ? await prisma.serviceValidationResultItem.count({ where: { runId: run.id } })
      : null;
  const validity = resolvePreparationChannelValidity({ run, resultItemCount, ...input });
  assertSelectedChannelRunPassCurrent(run, validity, channel);
  assertSelectedChannelResultsNonEmpty(channel, resultItemCount);
  if (channel === "DOWNLOAD") {
    await assertDownloadTestEvidenceReady(prisma, run.id);
  }
  const { confirmation, confStatus } = await loadSelectedChannelConfirmation({
    runId: run.id,
    validity,
    channel,
  });
  return {
    status: run.status,
    runId: run.id,
    testedAt: run.testedAt?.toISOString() ?? null,
    providerConfirmationStatus: confStatus,
    providerConfirmationId: confirmation.id,
    confirmedAt: confirmation.confirmedAt.toISOString(),
  };
}

export async function assertSelectedServiceValidationsPassed(input: {
  versionId: string;
  distribution: Pick<PackDistributionMetadata, "allowApi" | "allowMcp" | "allowDownload">;
  bindingFingerprint?: string | null;
  bindingIndexGenerationId?: string | null;
}): Promise<Record<string, ServiceValidationSubmitSnapshotEntry>> {
  assertDistributionChannelsSelected(input.distribution);
  const selected = selectedServiceChannels(input.distribution);
  const snapshot: Record<string, ServiceValidationSubmitSnapshotEntry> = {};
  for (const channel of selected) {
    snapshot[channel] = await assertSelectedChannelPassed({
      versionId: input.versionId,
      channel,
      bindingFingerprint: input.bindingFingerprint,
      bindingIndexGenerationId: input.bindingIndexGenerationId,
    });
  }
  await assertSharedApiMcpConfirmationEvidenceIfGrouped(prisma, {
    apiRunId: snapshot.API?.runId,
    mcpRunId: snapshot.MCP?.runId,
    apiConfirmationId: snapshot.API?.providerConfirmationId,
    mcpConfirmationId: snapshot.MCP?.providerConfirmationId,
  });
  return snapshot;
}
