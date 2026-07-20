import { PackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { evaluatePackStructureQuality } from "@/lib/structure-quality/structure-quality-evaluate-service";
import { evaluatePackChunkQuality } from "@/lib/chunk-quality/chunk-quality-evaluate-service";
import { regenerateAutoChunksForPack } from "@/lib/auto-pipeline/provider-auto-chunk-service";
import { runProviderReviewPreparationPipeline } from "@/lib/auto-pipeline/provider-review-preparation-service";
import {
  generateRetrievalEvaluationCasesForPack,
  runRetrievalEvaluationForPack,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-service";
import { evaluateReleaseGateForPack } from "@/lib/release-gate/release-gate-service";
import { getProviderPackForClient } from "@/lib/provider-pack/provider-pack-query-service";

export async function evaluateProviderPackStructureQuality(userId: string, clientId: string, packId: string) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_EDITABLE" as const };
  }

  const result = await evaluatePackStructureQuality({
    packId,
    actorClientId: clientId,
  });

  if ("error" in result) {
    if (result.error === "NOT_FOUND") {
      return { error: "NOT_FOUND" as const };
    }
    return { error: "INCOMPLETE" as const, message: "버전이 없습니다." };
  }

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail!, evaluation: result };
}

export async function evaluateProviderPackChunkQuality(
  userId: string,
  clientId: string,
  packId: string,
  options?: { regenerate?: boolean },
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_EDITABLE" as const };
  }

  if (options?.regenerate !== false) {
    const regenerated = await regenerateAutoChunksForPack({
      packId,
      actorClientId: clientId,
      mode: "hybrid",
      replace: true,
    });
    if ("error" in regenerated && regenerated.error !== "NO_DRAFTS") {
      return {
        error: "INCOMPLETE" as const,
        message: regenerated.message,
      };
    }
  }

  const result = await evaluatePackChunkQuality({
    packId,
    actorClientId: clientId,
  });

  if ("error" in result) {
    if (result.error === "NOT_FOUND") {
      return { error: "NOT_FOUND" as const };
    }
    if (result.error === "NO_VERSION") {
      return { error: "INCOMPLETE" as const, message: "버전이 없습니다." };
    }
    return {
      error: "INCOMPLETE" as const,
      message: result.message,
    };
  }

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail!, evaluation: result };
}

function mapRetrievalEvaluationServiceError(
  result:
    | { error: "NOT_FOUND" }
    | { error: "NO_VERSION" }
    | { error: "CHUNK_QUALITY_NOT_READY"; message: string }
    | { error: "STRUCTURE_QUALITY_NOT_READY"; message: string }
    | { error: "NO_ACTIVE_CHUNKS"; message: string }
    | { error: "INCOMPLETE"; code: "CASES_EMPTY"; message: string }
    | { error: "RETRIEVAL_EVAL_CASES_MISSING"; message: string },
) {
  if (result.error === "NOT_FOUND") {
    return { error: "NOT_FOUND" as const };
  }
  if (result.error === "NO_VERSION") {
    return { error: "INCOMPLETE" as const, message: "버전이 없습니다." };
  }
  return {
    error: "INCOMPLETE" as const,
    message: result.message,
  };
}

export async function generateProviderPackRetrievalEvaluationCases(
  userId: string,
  clientId: string,
  packId: string,
  replace?: boolean,
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_EDITABLE" as const };
  }

  const result = await generateRetrievalEvaluationCasesForPack({
    packId,
    actorClientId: clientId,
    replace,
  });

  if ("error" in result) {
    return mapRetrievalEvaluationServiceError(result);
  }

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail!, evaluation: result };
}

export async function runProviderPackRetrievalEvaluation(userId: string, clientId: string, packId: string) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_EDITABLE" as const };
  }

  const result = await runRetrievalEvaluationForPack({
    packId,
    actorClientId: clientId,
  });

  if ("error" in result) {
    return mapRetrievalEvaluationServiceError(result);
  }

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail!, evaluation: result };
}

export async function runProviderPackInspectionAutoPrepare(
  userId: string,
  clientId: string,
  packId: string,
  options?: { runRetrievalEvaluation?: boolean; repairRetrievalData?: boolean },
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_EDITABLE" as const };
  }

  const preparation = await runProviderReviewPreparationPipeline({
    packId,
    actorClientId: clientId,
    replaceAutoChunks: true,
    runRetrievalEvaluation: options?.runRetrievalEvaluation !== false,
    repairRetrievalData: options?.repairRetrievalData === true,
  });

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail!, preparation };
}

export async function evaluateProviderPackReleaseGate(
  userId: string,
  clientId: string,
  packId: string,
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);
  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
  });
  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }
  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_EDITABLE" as const };
  }

  const result = await evaluateReleaseGateForPack({
    packId,
    actorClientId: clientId,
    targetStatus: "PUBLISHED",
    persist: true,
  });
  if ("error" in result) {
    return { error: "NOT_FOUND" as const };
  }

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail!, releaseGate: result.result };
}
