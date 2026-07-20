import { AuditAction, PackStatus, PipelineStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  logPipelineRecordFailure,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { evaluateSourceValidation } from "@/lib/source-type-dto";
import { validateSourceDocumentContent } from "@/lib/source-validation/source-validation-runner";
import {
  persistSourceValidationResult,
  validateAndPersistSourceDocument,
} from "@/lib/source-validation/source-validation-report-service";
import type { CreateSourceDocumentInput } from "@/lib/provider-pack/provider-pack-types";
import { getProviderPackForClient } from "@/lib/provider-pack/provider-pack-query-service";

async function recordSourceRegisteredPipeline(
  packId: string,
  clientId: string,
  validationStatus: string,
  sourceType: string,
) {
  const targetStatus = PipelineStatus.SOURCE_REGISTERING;
  const triggerType = "SOURCE_DOCUMENT_REGISTERED";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: clientId,
      steps: [PipelineStatus.SOURCE_REGISTERING],
    });

    if ("runId" in run) {
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.SOURCE_REGISTERING,
        status: validationStatus === "WARNING" ? "WARNING" : "PASS",
        message: `원천 문서 등록 (${sourceType})`,
        details: { validationStatus },
      });
      await finishPipelineRun({
        runId: run.runId,
        status: validationStatus === "WARNING" ? "WARNING" : "PASS",
        summary: "원천 문서 등록 처리 완료",
      });
    } else {
      logPipelineRecordFailure("recordSourceRegisteredPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: run.error,
      });
    }

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: targetStatus,
      triggeredByClientId: clientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordSourceRegisteredPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordSourceRegisteredPipeline", {
      packId,
      triggerType,
      targetStatus,
      error,
    });
  }
}

export async function createSourceDocumentForProviderPack(
  userId: string,
  clientId: string,
  packId: string,
  input: CreateSourceDocumentInput,
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
    include: {
      versions: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_EDITABLE" as const };
  }

  const title = input.title.trim();
  const sourceType = input.sourceType;
  const sourceFormat = input.sourceFormat ?? "TEXT";

  if (!title) {
    return { error: "VALIDATION" as const, message: "제목이 필요합니다." };
  }
  if (!sourceType) {
    return { error: "VALIDATION" as const, message: "sourceType이 필요합니다." };
  }

  const version = pack.versions[0];
  if (!version) {
    return { error: "VERSION_REQUIRED" as const };
  }

  const siblingDocs = await prisma.sourceDocument.findMany({
    where: { versionId: version.id },
    select: { checksum: true },
  });
  const siblingChecksums = siblingDocs
    .map((d) => d.checksum?.trim())
    .filter((c): c is string => Boolean(c));

  const fullValidation = validateSourceDocumentContent(
    {
      title,
      sourceType,
      sourceFormat,
      content: input.content,
      sourceUrl: input.sourceUrl,
      productVersion: input.productVersion,
      checksum: input.checksum,
    },
    { packId, versionId: version.id, siblingChecksums },
  );

  if (fullValidation.status === "FAIL") {
    return { error: "VALIDATION" as const, message: fullValidation.summary };
  }

  const lightweight = evaluateSourceValidation({
    title,
    sourceType,
    sourceFormat,
    content: input.content,
    sourceUrl: input.sourceUrl,
    productVersion: input.productVersion,
  });
  if (lightweight.status === "FAIL") {
    return { error: "VALIDATION" as const, message: lightweight.summary };
  }

  const doc = await prisma.sourceDocument.create({
    data: {
      versionId: version.id,
      title,
      sourceType,
      sourceFormat,
      sourceUrl: input.sourceUrl?.trim() || null,
      fileName: input.fileName?.trim() || null,
      mimeType: input.mimeType?.trim() || null,
      content: input.content?.trim() || null,
      checksum: input.checksum ?? null,
      productVersion: input.productVersion?.trim() || null,
      documentVersion: input.documentVersion?.trim() || null,
      licenseStatus: input.licenseStatus?.trim() || null,
      validationStatus: fullValidation.status,
      validationSummary: fullValidation.summary,
      registeredByClientId: clientId,
    },
  });

  await persistSourceValidationResult({
    sourceDocument: doc,
    packId,
    result: fullValidation,
    actorClientId: clientId,
    triggerType: "SOURCE_DOCUMENT_REGISTERED",
    recordPipeline: false,
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_SOURCE_DOCUMENT_CREATE,
    entityType: "SourceDocument",
    entityId: doc.id,
    metadata: { packId, sourceType, sourceFormat, validationStatus: fullValidation.status },
  });

  await recordSourceRegisteredPipeline(packId, clientId, fullValidation.status, sourceType);

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail! };
}

export async function validateProviderSourceDocument(
  userId: string,
  clientId: string,
  packId: string,
  sourceDocumentId: string,
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

  const doc = await prisma.sourceDocument.findFirst({
    where: { id: sourceDocumentId, version: { packId } },
  });

  if (!doc) {
    return { error: "NOT_FOUND" as const };
  }

  const validation = await validateAndPersistSourceDocument(sourceDocumentId, {
    actorClientId: clientId,
    triggerType: "SOURCE_DOCUMENT_VALIDATE",
  });

  if ("error" in validation) {
    return { error: "NOT_FOUND" as const };
  }

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail!, report: validation.report };
}
