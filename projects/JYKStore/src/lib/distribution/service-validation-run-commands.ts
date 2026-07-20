/**
 * Executes a service-validation run (API / MCP / DOWNLOAD channel) and persists evidence.
 *
 * Channel-specific adapter execution lives in `service-validation-run-execute.ts`;
 * the write-transaction's re-validate + persist steps live in
 * `service-validation-run-persist-tx.ts`. This file only sequences: preconditions
 * -> execute the chosen channel -> persist -> map to the provider DTO.
 */
import { PayloadServiceError } from "@/lib/distribution/payload-errors";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import { prisma } from "@/lib/prisma";
import type { CurrentValidationBinding } from "@/lib/distribution/service-validation-binding";
import {
  assertSearchEvaluationCurrentForChannel,
  SEARCH_VALIDATION_PREPARATION_CHANNELS,
  type ServiceValidationChannelDto,
} from "@/lib/distribution/service-validation-policy";
import {
  assertNoOpenPackReview,
  loadBindingContext,
  requireOwnedDraftPackForServiceValidationRun,
} from "@/lib/distribution/service-validation-queries";
import { mapRunToProviderChannelDto } from "@/lib/distribution/service-validation-provider-status";
import {
  assertValidationQueryPresent,
  runApiChannelValidation,
  runDownloadChannelValidation,
  runMcpChannelValidation,
  type ChannelRunOutcome,
} from "@/lib/distribution/service-validation-run-execute";
import { persistServiceValidationRunInTx } from "@/lib/distribution/service-validation-run-persist-tx";

type BindingContext = Awaited<ReturnType<typeof loadBindingContext>>;

/** Pure: the channel must be a supported preparation channel and the binding must be CURRENT. */
function assertChannelSupportedAndBindingCurrent(
  channel: ServiceChannel,
  bindingContext: BindingContext,
): asserts bindingContext is BindingContext & {
  latest: NonNullable<BindingContext["latest"]>;
  binding: NonNullable<BindingContext["binding"]>;
} {
  if (!SEARCH_VALIDATION_PREPARATION_CHANNELS.includes(channel)) {
    throw new PayloadServiceError("SERVICE_CHANNEL_DISABLED", "지원하지 않는 검증 채널입니다.", 400);
  }
  const { binding, latest, bindingState } = bindingContext;
  if (binding && latest && bindingState.status === "CURRENT") return;
  if (bindingState.status === "NOT_READY") {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "데이터 구조화가 아직 진행 중입니다. 완료 후 다시 검증해 주세요.",
      409,
    );
  }
  if (bindingState.status === "STALE") {
    throw new PayloadServiceError(
      "SERVICE_VALIDATION_STALE",
      "지식 데이터가 변경되어 서비스 검증을 다시 실행해야 합니다.",
      409,
    );
  }
  throw new PayloadServiceError(
    "INCOMPLETE",
    "데이터 구조화가 완료되어야 검색데이터 검증을 진행할 수 있습니다.",
    400,
  );
}

/** DB-backed: for API/MCP channels, the pre-run search-evaluation must still be current. */
async function assertPreRunSearchEvaluationCurrent(
  channel: ServiceChannel,
  pipelineRunId: string,
): Promise<void> {
  if (channel !== "API" && channel !== "MCP") return;
  const evalStep = await prisma.pipelineStepLog.findFirst({
    where: { runId: pipelineRunId, step: "SEARCH_EVALUATING" },
    select: { status: true, details: true },
  });
  assertSearchEvaluationCurrentForChannel({ channel, status: evalStep?.status, details: evalStep?.details });
}

/** Dispatches to the per-channel adapter and returns its run outcome. */
async function executeChannelValidation(input: {
  channel: ServiceChannel;
  packId: string;
  versionId: string;
  binding: CurrentValidationBinding;
  query: string | null;
  started: number;
}): Promise<ChannelRunOutcome> {
  if (input.channel === "API" || input.channel === "MCP") {
    assertValidationQueryPresent(input.query);
    const args = {
      query: input.query,
      versionId: input.versionId,
      packId: input.packId,
      indexGenerationId: input.binding.indexGenerationId,
      normalizedDocumentId: input.binding.normalizedDocumentId,
      started: input.started,
    };
    return input.channel === "API" ? runApiChannelValidation(args) : runMcpChannelValidation(args);
  }
  return runDownloadChannelValidation({
    packId: input.packId,
    versionId: input.versionId,
    binding: input.binding,
    started: input.started,
  });
}

export async function runServiceChannelValidation(input: {
  userId: string;
  clientId: string;
  packId: string;
  channel: ServiceChannel;
  query?: string | null;
}): Promise<ServiceValidationChannelDto> {
  const { pack, version, profile } = await requireOwnedDraftPackForServiceValidationRun(input);
  await assertNoOpenPackReview(prisma, pack.packId);
  const bindingContext = await loadBindingContext(pack.packId, version.id);
  assertChannelSupportedAndBindingCurrent(input.channel, bindingContext);
  const { latest, binding } = bindingContext;
  await assertPreRunSearchEvaluationCurrent(input.channel, latest.id);

  const started = Date.now();
  const query = input.query?.trim() || null;
  const outcome = await executeChannelValidation({
    channel: input.channel,
    packId: pack.packId,
    versionId: version.id,
    binding,
    query,
    started,
  });

  const row = await prisma.$transaction((tx) =>
    persistServiceValidationRunInTx({
      tx,
      packId: pack.packId,
      providerProfileId: profile.id,
      versionId: version.id,
      channel: input.channel,
      userId: input.userId,
      query,
      latestRunId: latest.id,
      binding,
      outcome,
    }),
  );

  return mapRunToProviderChannelDto({
    channel: input.channel,
    run: row,
    bindingFingerprint: binding.fingerprint,
    bindingIndexGenerationId: binding.indexGenerationId,
    canRunValidation: true,
    userNames: new Map(),
  });
}
