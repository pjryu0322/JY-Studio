import { PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toPackLanguageCode } from "@/lib/pack-language";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import {
  toProviderPackListItem,
  type ProviderPackDetailDto,
  type ProviderPackListItemDto,
} from "@/lib/provider-pack-dto";
import {
  batchResolveListRegistrationProgressInputs,
  type ListPackForBatch,
} from "@/lib/provider-registration-readiness-from-db";
import {
  buildProviderPackProgress,
  buildProviderPacksStatusSummary,
  type ProviderPacksStatusSummary,
} from "@/lib/provider-pack-progress";
import {
  packDetailInclude,
  mapProviderPackDetailWithValidation,
} from "@/lib/provider-pack/provider-pack-shared";
import { isProviderRejectionAcknowledged } from "@/lib/pack-review-rejection-ack";
import {
  batchResolveProviderAdminGenerationHold,
  deriveListWorkerZipRequestStatus,
  resolveProviderAdminGenerationHold,
  WORKER_ZIP_REQUEST_TRIGGER,
} from "@/lib/python-worker/worker-zip-import-provider-service";
import { batchResolveStoreWorkflowMarkers, resolveStoreWorkflowMarkers } from "@/lib/store-workflow-markers";

export async function listProviderPacksForClient(
  userId: string,
  clientId: string,
): Promise<{ items: ProviderPackListItemDto[]; summary: ProviderPacksStatusSummary }> {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return {
      items: [],
      summary: buildProviderPacksStatusSummary([]),
    };
  }

  const packs = await prisma.knowledgePack.findMany({
    where: { providerProfileId: profile.id },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 2,
        include: {
          sourceDocuments: { select: { id: true } },
          distributionMetadata: {
            select: {
              sourceTitle: true,
              sourceUrl: true,
              licenseName: true,
              rightsBasis: true,
              rightsConfirmedAt: true,
              allowApi: true,
              allowMcp: true,
              allowDownload: true,
            },
          },
          doclingImportBundles: {
            where: { deletedAt: null },
            orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
            take: 1,
            select: { status: true },
          },
        },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { rejectionReason: true, decision: true },
      },
    },
  });

  const batchInput: ListPackForBatch[] = packs.map((pack) => {
    const working = pack.versions[0] ?? null;
    const latestRejectionReason = pack.reviews[0]?.rejectionReason?.trim() || null;
    const dist = working?.distributionMetadata;
    return {
      packId: pack.packId,
      packStatus: pack.status,
      pipelineStatus: pack.pipelineStatus,
      name: pack.name,
      categoryId: pack.categoryId,
      shortDescription: pack.shortDescription,
      description: pack.description,
      language: toPackLanguageCode(working?.language),
      latestRejectionReason,
      workingVersion: working
        ? {
            id: working.id,
            version: working.version,
            sourceDocumentCount: working.sourceDocuments.length,
            distribution: {
              sourceTitle: dist?.sourceTitle,
              sourceUrl: dist?.sourceUrl,
              licenseName: dist?.licenseName,
              rightsBasis: dist?.rightsBasis,
              rightsConfirmedAt: dist?.rightsConfirmedAt,
              allowApi: dist?.allowApi,
              allowMcp: dist?.allowMcp,
              allowDownload: dist?.allowDownload,
            },
          }
        : null,
      publishedVersion: null,
    };
  });

  const workingByPackId = await batchResolveListRegistrationProgressInputs({
    packs: batchInput,
  });

  const packIds = packs.map((p) => p.packId);
  const [holdsByPackId, markersByPackId, pendingMarkers] = await Promise.all([
    batchResolveProviderAdminGenerationHold(packIds),
    batchResolveStoreWorkflowMarkers(packIds),
    prisma.pipelineRun.findMany({
      where: {
        packId: { in: packIds },
        triggerType: WORKER_ZIP_REQUEST_TRIGGER,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
      select: { packId: true },
    }),
  ]);
  const pendingRequestPackIds = new Set(pendingMarkers.map((m) => m.packId));

  const items = packs.map((pack) => {
    const working = pack.versions[0] ?? null;
    const previous = pack.versions[1] ?? null;
    const latestRejectionReason = pack.reviews[0]?.rejectionReason?.trim() || null;

    const isPublished =
      pack.status === PackStatus.PUBLISHED || pack.status === PackStatus.VERIFIED;

    // Newest version is the working version. When published with multiple versions,
    // the previous one is treated as the last published snapshot.
    const publishedVersion =
      isPublished && working
        ? previous
          ? { id: previous.id, version: previous.version }
          : { id: working.id, version: working.version }
        : null;

    const workingVersion = working ? (workingByPackId.get(pack.packId) ?? null) : null;
    const adminGenerationHold = holdsByPackId.get(pack.packId) ?? null;
    const markers = markersByPackId.get(pack.packId);
    const workerZipRequestStatus = deriveListWorkerZipRequestStatus({
      adminGenerationHold,
      hasPendingRequestMarker: pendingRequestPackIds.has(pack.packId),
    });

    const progress = buildProviderPackProgress({
      packId: pack.packId,
      packStatus: pack.status,
      name: pack.name,
      categoryId: pack.categoryId,
      shortDescription: pack.shortDescription,
      description: pack.description,
      language: toPackLanguageCode(working?.language),
      latestRejectionReason,
      adminGenerationHold,
      workerZipRequestStatus,
      providerReviewPhase: markers?.providerReviewPhase ?? "NONE",
      serviceValidationPhase: markers?.serviceValidationPhase ?? "NONE",
      workingVersion,
      publishedVersion,
    });

    return toProviderPackListItem(pack, {
      currentStep: progress.currentStep,
      currentStepLabel: progress.currentStepLabel,
      nextActionLabel: progress.nextActionLabel,
      nextActionHref: progress.nextActionHref,
      publishedVersion: progress.publishedVersion?.version ?? null,
      workingVersion: progress.workingVersion?.version ?? null,
      actions: progress.actions,
      storeWorkflowStatus: progress.storeWorkflowStatus,
    });
  });

  const summary = buildProviderPacksStatusSummary(
    items.map((item, index) => ({
      status: packs[index]!.status,
      latestRejectionReason: packs[index]!.reviews[0]?.rejectionReason?.trim() || null,
      storeWorkflowStatus: item.progress?.storeWorkflowStatus,
      providerReviewPhase: markersByPackId.get(packs[index]!.packId)?.providerReviewPhase ?? null,
    })),
  );

  return { items, summary };
}

export async function getProviderPackForClient(
  userId: string,
  clientId: string,
  packId: string,
): Promise<ProviderPackDetailDto | null> {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return null;
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId,
      providerProfileId: profile.id,
    },
    include: packDetailInclude,
  });

  return pack ? await mapProviderPackDetailWithValidation(pack) : null;
}

export async function assertProviderPackEditableForClient(
  userId: string,
  clientId: string,
  packId: string,
): Promise<
  | { ok: true; packId: string; status: PackStatus }
  | { ok: false; error: "PROFILE_REQUIRED" | "NOT_FOUND" | "NOT_EDITABLE"; status?: PackStatus }
> {
  const trimmedPackId = packId.trim();
  if (!trimmedPackId) {
    return { ok: false, error: "NOT_FOUND" };
  }

  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { ok: false, error: "PROFILE_REQUIRED" };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: {
      packId: trimmedPackId,
      providerProfileId: profile.id,
    },
    select: { packId: true, status: true },
  });

  if (!pack) {
    return { ok: false, error: "NOT_FOUND" };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { ok: false, error: "NOT_EDITABLE", status: pack.status };
  }

  const openReview = await prisma.packReview.findFirst({
    where: {
      packId: pack.packId,
      status: { in: ["PENDING", "IN_REVIEW"] },
    },
    select: { id: true },
  });
  if (openReview) {
    return { ok: false, error: "NOT_EDITABLE", status: pack.status };
  }

  const adminGenerationHold = await resolveProviderAdminGenerationHold(pack.packId);
  if (adminGenerationHold) {
    return { ok: false, error: "NOT_EDITABLE", status: pack.status };
  }

  const markers = await resolveStoreWorkflowMarkers(pack.packId);
  if (
    markers.providerReviewPhase === "REQUESTED" ||
    markers.providerReviewPhase === "CONFIRMED"
  ) {
    return { ok: false, error: "NOT_EDITABLE", status: pack.status };
  }

  const latestRejected = await prisma.packReview.findFirst({
    where: { packId: pack.packId, decision: "REJECT" },
    orderBy: { decidedAt: "desc" },
    select: { rejectionReason: true, submitSnapshot: true },
  });
  if (
    latestRejected?.rejectionReason?.trim() &&
    !isProviderRejectionAcknowledged(latestRejected.submitSnapshot)
  ) {
    return { ok: false, error: "NOT_EDITABLE", status: pack.status };
  }

  return { ok: true, packId: pack.packId, status: pack.status };
}
