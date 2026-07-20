import { PackStatus, type SearchIndexGeneration } from "@prisma/client";
import {
  DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
} from "@/lib/docling-knowledge/docling-knowledge-stages";
import {
  getDoclingKnowledgePipelineStatus,
} from "@/lib/docling-knowledge/docling-knowledge-pipeline-service";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { LOCAL_E5_EMBEDDING_PROVIDER } from "@/lib/embedding/e5-embedding-constants";
import { prisma } from "@/lib/prisma";
import {
  buildSearchDataStatusResponse,
  type SearchDataStatusResponse,
} from "@/lib/search-data/search-data-state";
import {
  asRecord,
  countRetrievalChunksForGeneration,
  countVectorsForGeneration,
  loadOwnedPack,
} from "@/lib/search-data/search-data-generation-shared";

function resolveCurrentLocalE5Generation(input: {
  generation: SearchIndexGeneration | null;
  binding: {
    normalizedDocumentId: string;
    fingerprint: string;
    indexGenerationId: string;
  } | null;
  versionId: string;
}): SearchIndexGeneration | null {
  const { generation, binding, versionId } = input;
  if (!generation || !binding) return null;
  if (generation.embeddingProvider !== LOCAL_E5_EMBEDDING_PROVIDER) return null;
  if (generation.versionId !== versionId) return null;
  if (generation.normalizedDocumentId !== binding.normalizedDocumentId) return null;
  if (generation.fingerprint !== binding.fingerprint) return null;
  if (generation.chunkGenerationId !== binding.indexGenerationId) return null;
  return generation;
}

function mapGenerationForStatus(generation: SearchIndexGeneration) {
  return {
    id: generation.id,
    status: generation.status,
    scope: generation.scope,
    embeddingProvider: generation.embeddingProvider,
    embeddingModel: generation.embeddingModel,
    embeddingModelRevision: generation.embeddingModelRevision,
    embeddingDimension: generation.embeddingDimension,
    chunkCount: generation.chunkCount,
    embeddedCount: generation.embeddedCount,
    failedCount: generation.failedCount,
    chunkGenerationId: generation.chunkGenerationId,
    pipelineRunId: generation.pipelineRunId,
    normalizedDocumentId: generation.normalizedDocumentId,
    fingerprint: generation.fingerprint,
    attempt: generation.attempt,
    failureCode: generation.failureCode,
    failureMessage: generation.failureMessage,
  };
}

function readEvalCounts(evalDetails: Record<string, unknown> | null) {
  const evalTotal =
    typeof evalDetails?.questionCount === "number"
      ? evalDetails.questionCount
      : typeof evalDetails?.totalCases === "number"
        ? evalDetails.totalCases
        : null;
  const evalPassed =
    typeof evalDetails?.passedCount === "number"
      ? evalDetails.passedCount
      : typeof evalDetails?.passedCases === "number"
        ? evalDetails.passedCases
        : null;
  return { evalTotal, evalPassed };
}

function resolveIndexingStatusForUi(
  isCurrentLocalE5: SearchIndexGeneration | null,
  indexingStepStatus: string | undefined,
): string | null {
  if (!isCurrentLocalE5) return null;
  if (indexingStepStatus === "RUNNING") return "RUNNING";
  if (indexingStepStatus === "FAIL") return "FAIL";
  return indexingStepStatus ?? null;
}

function resolveEvaluationStatusForUi(
  isCurrentLocalE5: SearchIndexGeneration | null,
  evalStepStatus: string | undefined,
): string | null {
  if (!isCurrentLocalE5) return null;
  if (evalStepStatus === "RUNNING") return "RUNNING";
  return evalStepStatus ?? null;
}

/**
 * Resolves current structure binding + Local E5 search-data status for the provider UI.
 */
export async function getSearchDataStatus(input: {
  userId: string;
  clientId: string;
  packId: string;
}): Promise<{ error: "NOT_FOUND" | "PROFILE_REQUIRED" } | SearchDataStatusResponse> {
  const owned = await loadOwnedPack(input);
  if (!owned.ok) return { error: owned.error };

  const knowledge = await getDoclingKnowledgePipelineStatus({
    userId: input.userId,
    clientId: input.clientId,
    packId: input.packId,
  });
  if ("error" in knowledge) return { error: knowledge.error };

  const version = owned.pack.versions[0];
  if (!version) {
    return buildSearchDataStatusResponse({
      structurePassed: false,
      pipelineCurrent: false,
      packStatusIsDraft: owned.pack.status === PackStatus.DRAFT,
      chunkCount: 0,
      generation: null,
      vectorCount: 0,
      message: "버전 정보가 없습니다.",
    });
  }

  const latest = await prisma.pipelineRun.findFirst({
    where: { packId: input.packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });
  const binding = latest ? parseKnowledgeRunBinding(latest.summary) : null;
  const indexGenerationId = binding?.indexGenerationId?.trim() || null;

  const chunkCount = indexGenerationId
    ? await countRetrievalChunksForGeneration({
        versionId: version.id,
        indexGenerationId,
      })
    : 0;

  const generation = indexGenerationId
    ? await prisma.searchIndexGeneration.findUnique({ where: { id: indexGenerationId } })
    : null;

  // Include FAILED Local E5 generations so CREATE_FAILED survives refresh.
  const isCurrentLocalE5 = resolveCurrentLocalE5Generation({
    generation,
    binding,
    versionId: version.id,
  });

  const vectorCount = isCurrentLocalE5 ? await countVectorsForGeneration(isCurrentLocalE5.id) : 0;

  const indexingStep = latest?.steps.find((s) => s.step === "INDEXING");
  const evalStep = latest?.steps.find((s) => s.step === "SEARCH_EVALUATING");
  const indexDetails = asRecord(indexingStep?.details);
  const evalDetails = asRecord(evalStep?.details);
  const { evalTotal, evalPassed } = readEvalCounts(evalDetails);

  const legacyLocalHashPresent =
    Boolean(indexingStep && indexingStep.status === "PASS") &&
    (indexDetails?.embeddingProvider === "local-hash" ||
      !isCurrentLocalE5 ||
      (generation != null && generation.embeddingProvider === "local-hash"));

  return buildSearchDataStatusResponse({
    structurePassed: knowledge.structurePassed,
    pipelineCurrent: knowledge.pipelineCurrent,
    packStatusIsDraft: owned.pack.status === PackStatus.DRAFT,
    chunkCount,
    generation: isCurrentLocalE5 ? mapGenerationForStatus(isCurrentLocalE5) : null,
    vectorCount,
    indexingStepStatus: resolveIndexingStatusForUi(isCurrentLocalE5, indexingStep?.status),
    evaluationStepStatus: resolveEvaluationStatusForUi(isCurrentLocalE5, evalStep?.status),
    evaluationPassedCases: evalPassed,
    evaluationTotalCases: evalTotal,
    evaluationRankingPolicyVersion:
      typeof evalDetails?.retrievalRankingPolicyVersion === "string"
        ? evalDetails.retrievalRankingPolicyVersion
        : null,
    legacyLocalHashPresent,
    serviceChannelsReady: true,
  });
}
