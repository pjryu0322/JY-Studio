/**
 * P9.1 — Publish recovery mode: Restore Existing vs New Revision Publish.
 *
 * Pure predicates + DB resolvers. No new DB enums.
 */

import { AuditAction, PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isOpenProviderSupplementPhase } from "@/lib/provider-supplement-request";
import {
  STORE_PROVIDER_REVIEW_TRIGGER,
  STORE_SERVICE_VALIDATION_TRIGGER,
  resolveCurrentPublishTargetGeneration,
  resolveStoreWorkflowMarkers,
} from "@/lib/store-workflow-markers";
import { parseProviderReviewRevisionBinding } from "@/lib/store-workflow-provider-review-binding";

const WORKER_ZIP_IMPORT_TRIGGER = "WORKER_ZIP_IMPORT";

export type PublishRecoveryMode =
  | "RESTORE_EXISTING"
  | "PUBLISH_NEW_REVISION"
  | "BLOCKED";

export type UnpublishSnapshot = {
  unpublishedAt: Date;
  preservedProductionGenerationId: string;
  preservedVersionId: string;
  auditId: string;
};

export type PostUnpublishChangeFlags = {
  newDraftReadyGeneration: boolean;
  newWorkerZipImport: boolean;
  newProviderReview: boolean;
  newServiceValidation: boolean;
  newOpenCorrection: boolean;
  newOpenSupplement: boolean;
  draftReadyDiffersFromPreserved: boolean;
};

export type PublishRecoveryResolution = {
  mode: PublishRecoveryMode;
  code: string | null;
  message: string;
  unpublishSnapshot: UnpublishSnapshot | null;
  preservedGenerationId: string | null;
  preservedVersionId: string | null;
  currentDraftGenerationId: string | null;
  currentDraftVersionId: string | null;
  changes: PostUnpublishChangeFlags | null;
  canRestoreExisting: boolean;
  canPublishNewRevision: boolean;
};

type PrismaClientLike = typeof prisma;

function emptyChanges(): PostUnpublishChangeFlags {
  return {
    newDraftReadyGeneration: false,
    newWorkerZipImport: false,
    newProviderReview: false,
    newServiceValidation: false,
    newOpenCorrection: false,
    newOpenSupplement: false,
    draftReadyDiffersFromPreserved: false,
  };
}

export function hasMaterialPostUnpublishChange(changes: PostUnpublishChangeFlags): boolean {
  return (
    changes.newDraftReadyGeneration ||
    changes.newWorkerZipImport ||
    changes.newProviderReview ||
    changes.newServiceValidation ||
    changes.newOpenCorrection ||
    changes.newOpenSupplement ||
    changes.draftReadyDiffersFromPreserved
  );
}

/** Pure: decide mode from already-loaded facts. */
export function resolvePublishRecoveryMode(input: {
  packStatus: string | null | undefined;
  hasUnpublishSnapshot: boolean;
  preservedProductionValid: boolean;
  materialChangeAfterUnpublish: boolean;
  hasCurrentDraftReady: boolean;
  openSupplement: boolean;
  openCorrection: boolean;
}): PublishRecoveryMode {
  if (input.packStatus !== PackStatus.DRAFT && input.packStatus !== "DRAFT") {
    return "BLOCKED";
  }
  if (!input.hasUnpublishSnapshot || !input.preservedProductionValid) {
    if (input.hasCurrentDraftReady) return "PUBLISH_NEW_REVISION";
    return "BLOCKED";
  }
  if (input.openSupplement || input.openCorrection) {
    return "BLOCKED";
  }
  if (input.materialChangeAfterUnpublish || input.hasCurrentDraftReady) {
    return "PUBLISH_NEW_REVISION";
  }
  return "RESTORE_EXISTING";
}

export async function resolveLatestUnpublishSnapshot(
  packId: string,
  client: PrismaClientLike = prisma,
): Promise<UnpublishSnapshot | null> {
  const trimmed = packId.trim();
  if (!trimmed) return null;

  const rows = await client.auditLog.findMany({
    where: {
      entityType: "KnowledgePack",
      entityId: trimmed,
      action: AuditAction.DEPRECATE,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, createdAt: true, metadata: true },
  });

  for (const row of rows) {
    const meta = row.metadata as Record<string, unknown> | null;
    if (!meta || meta.action !== "UNPUBLISH") continue;
    const genId =
      typeof meta.preservedProductionGenerationId === "string"
        ? meta.preservedProductionGenerationId.trim()
        : "";
    const versionId =
      typeof meta.preservedVersionId === "string" ? meta.preservedVersionId.trim() : "";
    if (!genId || !versionId) continue;
    return {
      unpublishedAt: row.createdAt,
      preservedProductionGenerationId: genId,
      preservedVersionId: versionId,
      auditId: row.id,
    };
  }
  return null;
}

export async function validatePreservedProductionGeneration(input: {
  packId: string;
  generationId: string;
  versionId: string;
  client?: PrismaClientLike;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const client = input.client ?? prisma;
  const generation = await client.searchIndexGeneration.findFirst({
    where: {
      id: input.generationId,
      packId: input.packId,
      versionId: input.versionId,
    },
    select: {
      id: true,
      scope: true,
      status: true,
      staleAt: true,
      retiredAt: true,
    },
  });
  if (!generation) {
    return {
      ok: false,
      code: "PRESERVED_GENERATION_MISSING",
      message: "Unpublish 당시 보존된 PRODUCTION 세대를 찾을 수 없습니다.",
    };
  }
  if (generation.scope !== "PRODUCTION" || generation.status !== "PROMOTED") {
    return {
      ok: false,
      code: "PRESERVED_GENERATION_NOT_ACTIVE",
      message: "보존된 세대가 더 이상 PRODUCTION/PROMOTED가 아닙니다.",
    };
  }
  if (generation.staleAt || generation.retiredAt) {
    return {
      ok: false,
      code: "PRESERVED_GENERATION_STALE",
      message: "보존된 PRODUCTION 세대가 stale/retired 상태입니다.",
    };
  }
  const version = await client.knowledgePackVersion.findFirst({
    where: { id: input.versionId, packId: input.packId },
    select: { id: true },
  });
  if (!version) {
    return {
      ok: false,
      code: "PRESERVED_VERSION_MISMATCH",
      message: "보존된 Version이 이 Pack에 속하지 않습니다.",
    };
  }
  return { ok: true };
}

export async function detectPostUnpublishChanges(input: {
  packId: string;
  unpublishedAt: Date;
  preservedProductionGenerationId: string;
  client?: PrismaClientLike;
}): Promise<PostUnpublishChangeFlags> {
  const client = input.client ?? prisma;
  const packId = input.packId.trim();
  const after = input.unpublishedAt;
  const changes = emptyChanges();

  const newDraft = await client.searchIndexGeneration.findFirst({
    where: {
      packId,
      scope: "DRAFT",
      status: "READY",
      staleAt: null,
      retiredAt: null,
      createdAt: { gt: after },
    },
    select: { id: true },
  });
  changes.newDraftReadyGeneration = Boolean(newDraft);

  const currentDraft = await resolveCurrentPublishTargetGeneration(packId, client);
  if (currentDraft && currentDraft.id !== input.preservedProductionGenerationId) {
    // Any current DRAFT READY distinct from preserved PRODUCTION identity signals new-revision path.
    // Pre-existing draft that survived promote may still be READY; treat as material when id differs
    // AND it was created after unpublish OR a newer zip/import/review happened.
    changes.draftReadyDiffersFromPreserved = true;
  }

  const zip = await client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: WORKER_ZIP_IMPORT_TRIGGER,
      status: "PASS",
      createdAt: { gt: after },
    },
    select: { id: true },
  });
  changes.newWorkerZipImport = Boolean(zip);

  const providerReview = await client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: STORE_PROVIDER_REVIEW_TRIGGER,
      status: { in: ["PENDING", "RUNNING", "PASS"] },
      createdAt: { gt: after },
    },
    select: { id: true, summary: true, status: true },
  });
  changes.newProviderReview = Boolean(providerReview);
  if (providerReview?.status === "PASS") {
    const binding = parseProviderReviewRevisionBinding(providerReview.summary);
    if (binding && binding.indexGenerationId !== input.preservedProductionGenerationId) {
      changes.draftReadyDiffersFromPreserved = true;
    }
  }

  const sv = await client.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: STORE_SERVICE_VALIDATION_TRIGGER,
      status: "PASS",
      createdAt: { gt: after },
    },
    select: { id: true },
  });
  changes.newServiceValidation = Boolean(sv);

  const openCorrection = await client.correctionCase.count({
    where: {
      packId,
      status: { in: ["OPEN", "APPLIED", "REGENERATED"] },
      OR: [{ createdAt: { gt: after } }, { updatedAt: { gt: after } }],
    },
  });
  changes.newOpenCorrection = openCorrection > 0;

  const markers = await resolveStoreWorkflowMarkers(packId, client);
  changes.newOpenSupplement = isOpenProviderSupplementPhase(markers.providerSupplementPhase);

  return changes;
}

/**
 * Full recovery resolution for UI + server gates.
 *
 * Restore Existing: preserved PRODUCTION, no material post-unpublish change.
 * New Revision: current DRAFT READY exists and differs / material change after unpublish.
 */
export async function resolvePublishRecoveryForPack(
  packId: string,
  client: PrismaClientLike = prisma,
): Promise<PublishRecoveryResolution> {
  const trimmed = packId.trim();
  const pack = await client.knowledgePack.findUnique({
    where: { packId: trimmed },
    select: { status: true },
  });
  if (!pack) {
    return {
      mode: "BLOCKED",
      code: "NOT_FOUND",
      message: "지식팩을 찾을 수 없습니다.",
      unpublishSnapshot: null,
      preservedGenerationId: null,
      preservedVersionId: null,
      currentDraftGenerationId: null,
      currentDraftVersionId: null,
      changes: null,
      canRestoreExisting: false,
      canPublishNewRevision: false,
    };
  }

  const snapshot = await resolveLatestUnpublishSnapshot(trimmed, client);
  const currentDraft = await resolveCurrentPublishTargetGeneration(trimmed, client);
  const markers = await resolveStoreWorkflowMarkers(trimmed, client);
  const openSupplement = isOpenProviderSupplementPhase(markers.providerSupplementPhase);
  const openCorrection =
    (await client.correctionCase.count({
      where: {
        packId: trimmed,
        status: { in: ["OPEN", "APPLIED", "REGENERATED"] },
      },
    })) > 0;

  let preservedValid = false;
  if (snapshot) {
    const validated = await validatePreservedProductionGeneration({
      packId: trimmed,
      generationId: snapshot.preservedProductionGenerationId,
      versionId: snapshot.preservedVersionId,
      client,
    });
    preservedValid = validated.ok;
  }

  const changes = snapshot
    ? await detectPostUnpublishChanges({
        packId: trimmed,
        unpublishedAt: snapshot.unpublishedAt,
        preservedProductionGenerationId: snapshot.preservedProductionGenerationId,
        client,
      })
    : null;

  // Material change: post-unpublish events OR a DRAFT READY that is not the preserved production
  // and was created after unpublish. Pre-promote leftover DRAFT READY alone does not block restore
  // unless new work happened after unpublish.
  let materialChange = false;
  if (changes) {
    materialChange =
      changes.newDraftReadyGeneration ||
      changes.newWorkerZipImport ||
      changes.newProviderReview ||
      changes.newServiceValidation ||
      changes.newOpenCorrection ||
      changes.newOpenSupplement;
  }

  const hasNewRevisionDraft =
    Boolean(currentDraft) &&
    Boolean(snapshot) &&
    currentDraft!.id !== snapshot!.preservedProductionGenerationId &&
    (materialChange || Boolean(changes?.newDraftReadyGeneration));

  // Also treat: draft ready created after unpublish even if ids somehow collide (shouldn't)
  const hasCurrentDraftReadyForNewPublish =
    hasNewRevisionDraft || Boolean(changes?.newDraftReadyGeneration);

  const mode = resolvePublishRecoveryMode({
    packStatus: pack.status,
    hasUnpublishSnapshot: Boolean(snapshot),
    preservedProductionValid: preservedValid,
    materialChangeAfterUnpublish: materialChange || hasCurrentDraftReadyForNewPublish,
    hasCurrentDraftReady: hasCurrentDraftReadyForNewPublish,
    openSupplement,
    openCorrection,
  });

  // Refine: if only leftover pre-unpublish DRAFT READY (same pipeline as A) and no material change → RESTORE
  let effectiveMode = mode;
  if (
    pack.status === PackStatus.DRAFT &&
    snapshot &&
    preservedValid &&
    !materialChange &&
    !changes?.newDraftReadyGeneration &&
    !openSupplement &&
    !openCorrection
  ) {
    effectiveMode = "RESTORE_EXISTING";
  }

  const canRestoreExisting = effectiveMode === "RESTORE_EXISTING";
  const canPublishNewRevision =
    effectiveMode === "PUBLISH_NEW_REVISION" &&
    Boolean(currentDraft) &&
    markers.serviceValidationPhase === "PASSED" &&
    markers.providerReviewPhase === "CONFIRMED" &&
    !openSupplement &&
    !openCorrection;

  let code: string | null = null;
  let message = "";
  if (effectiveMode === "RESTORE_EXISTING") {
    message = "Unpublish 이후 변경이 없어 기존 PRODUCTION 게시본을 다시 서비스할 수 있습니다.";
  } else if (effectiveMode === "PUBLISH_NEW_REVISION") {
    code = "NEW_REVISION_PENDING";
    message =
      "Unpublish 이후 새 Draft/Revision 작업이 있습니다. 기존 게시본 복구 대신 새 Revision 게시를 진행하세요.";
  } else if (openSupplement || openCorrection) {
    code = openSupplement ? "PROVIDER_SUPPLEMENT_OPEN" : "UNRESOLVED_CORRECTION";
    message = openSupplement
      ? "열린 제공자 보완요청을 먼저 처리해야 합니다."
      : "미해결 보정 건이 있어 게시할 수 없습니다.";
  } else if (!snapshot) {
    code = "UNPUBLISH_SNAPSHOT_MISSING";
    message = "게시 중단(Unpublish) 기록이 없어 기존 게시본을 복구할 수 없습니다.";
  } else if (!preservedValid) {
    code = "PRESERVED_GENERATION_NOT_ACTIVE";
    message = "보존된 PRODUCTION 세대가 유효하지 않습니다.";
  } else {
    code = "PUBLISH_RECOVERY_BLOCKED";
    message = "게시 복구/새 Revision 게시 조건을 충족하지 않습니다.";
  }

  return {
    mode: effectiveMode,
    code,
    message,
    unpublishSnapshot: snapshot,
    preservedGenerationId: snapshot?.preservedProductionGenerationId ?? null,
    preservedVersionId: snapshot?.preservedVersionId ?? null,
    currentDraftGenerationId: currentDraft?.id ?? null,
    currentDraftVersionId: currentDraft?.versionId ?? null,
    changes,
    canRestoreExisting,
    canPublishNewRevision,
  };
}
