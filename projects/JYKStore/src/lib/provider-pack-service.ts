import {
  AuditAction,
  PackPricing,
  PackStatus,
  PipelineStatus,
  ProviderType,
  type SourceFormat,
  type SourceType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordProviderAudit } from "@/lib/provider-audit";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  logPipelineRecordFailure,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { evaluateSourceValidation } from "@/lib/source-type-dto";
import {
  countSourceValidationFromStatuses,
  meetsSourceValidationSubmitGate,
} from "@/lib/source-validation-readiness";
import {
  evaluatePackStructureQuality,
} from "@/lib/structure-quality/structure-quality-evaluate-service";
import { loadStructureQualitySummaryForPack } from "@/lib/structure-quality/structure-quality-freshness";
import { evaluatePackChunkQuality } from "@/lib/chunk-quality/chunk-quality-evaluate-service";
import { loadChunkQualitySummaryForPack } from "@/lib/chunk-quality/chunk-quality-freshness";
import {
  chunkQualityGateSnapshotFromSummary,
  getChunkQualityBlockingMessage,
  meetsChunkQualityGate,
} from "@/lib/chunk-quality/chunk-quality-readiness";
import {
  getStructureQualityBlockingMessage,
  meetsStructureQualityGate,
  structureQualityGateSnapshotFromSummary,
} from "@/lib/structure-quality/structure-quality-readiness";
import { validateSourceDocumentContent } from "@/lib/source-validation/source-validation-runner";
import {
  loadLatestReportsByDocumentIds,
  persistSourceValidationResult,
  validateAndPersistSourceDocument,
} from "@/lib/source-validation/source-validation-report-service";
import {
  toProviderPackDetail,
  toProviderPackListItem,
  type ProviderPackDetailDto,
  type ProviderSourceDocumentValidationOverlay,
} from "@/lib/provider-pack-dto";

const PACK_ID_PATTERN = /^[a-z0-9-]{3,60}$/;

export type CreateProviderPackInput = {
  packId: string;
  name: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  tags?: string[];
  version?: string;
};

export type UpdateProviderPackInput = {
  name?: string;
  categoryId?: string;
  shortDescription?: string;
  description?: string;
  tags?: string[];
  icon?: string;
  pricing?: PackPricing;
  versionOverview?: string;
  versionFeatures?: string[];
  versionIncludedKnowledge?: string[];
  versionSupportedEnvironments?: string[];
  versionTargetUsers?: string[];
  versionUseCases?: string[];
  versionSummary?: string;
};

export type CreatePackVersionInput = {
  version: string;
  overview?: string;
  features?: string[];
  includedKnowledge?: string[];
  supportedEnvironments?: string[];
  targetUsers?: string[];
  useCases?: string[];
  versionSummary?: string;
};

export type CreateSourceDocumentInput = {
  title: string;
  sourceType: SourceType;
  sourceFormat?: SourceFormat;
  sourceUrl?: string;
  fileName?: string;
  mimeType?: string;
  content?: string;
  checksum?: string | null;
  productVersion?: string;
  documentVersion?: string;
  licenseStatus?: string;
};

const packDetailInclude = {
  versions: {
    orderBy: { createdAt: "desc" as const },
    include: {
      sourceDocuments: {
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
} as const;

function validateCreatePackInput(input: CreateProviderPackInput): string | null {
  const packId = input.packId.trim();
  const name = input.name.trim();
  const categoryId = input.categoryId.trim();
  const shortDescription = input.shortDescription.trim();
  const description = input.description.trim();
  const tags = input.tags ?? [];
  const version = (input.version?.trim() || "0.1.0").trim();

  if (!PACK_ID_PATTERN.test(packId)) {
    return "packId는 영문 소문자, 숫자, 하이픈만 3~60자로 입력해 주세요.";
  }
  if (!categoryId) {
    return "카테고리가 필요합니다.";
  }
  if (name.length < 2 || name.length > 100) {
    return "이름은 2~100자로 입력해 주세요.";
  }
  if (shortDescription.length < 10 || shortDescription.length > 160) {
    return "짧은 설명은 10~160자로 입력해 주세요.";
  }
  if (description.length < 20 || description.length > 1000) {
    return "설명은 20~1000자로 입력해 주세요.";
  }
  if (tags.length > 10) {
    return "태그는 최대 10개까지 등록할 수 있습니다.";
  }
  if (!version) {
    return "버전이 필요합니다.";
  }

  return null;
}

async function assertCategoryExists(categoryId: string) {
  const category = await prisma.packCategory.findUnique({
    where: { categoryId },
  });
  return Boolean(category);
}

export async function listProviderPacksForClient(clientId: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

  if (!profile) {
    return [];
  }

  const packs = await prisma.knowledgePack.findMany({
    where: { providerProfileId: profile.id },
    orderBy: { updatedAt: "desc" },
  });

  return packs.map(toProviderPackListItem);
}

export async function createProviderPackForClient(
  clientId: string,
  input: CreateProviderPackInput,
) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const validationMessage = validateCreatePackInput(input);
  if (validationMessage) {
    return { error: "VALIDATION" as const, message: validationMessage };
  }

  const packId = input.packId.trim();
  const categoryId = input.categoryId.trim();

  if (!(await assertCategoryExists(categoryId))) {
    return { error: "CATEGORY_NOT_FOUND" as const };
  }

  const existing = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (existing) {
    return { error: "PACK_ID_EXISTS" as const };
  }

  const name = input.name.trim();
  const shortDescription = input.shortDescription.trim();
  const description = input.description.trim();
  const tags = (input.tags ?? []).map((t) => t.trim()).filter(Boolean);
  const versionLabel = (input.version?.trim() || "0.1.0").trim();

  const pack = await prisma.knowledgePack.create({
    data: {
      packId,
      name,
      categoryId,
      providerName: profile.displayName,
      providerType: ProviderType.COMMUNITY,
      providerProfileId: profile.id,
      status: PackStatus.DRAFT,
      pricing: PackPricing.FREE,
      icon: "📦",
      shortDescription,
      description,
      tags,
      versions: {
        create: {
          version: versionLabel,
          overview: shortDescription,
          features: [],
          includedKnowledge: [],
          supportedEnvironments: [],
          targetUsers: [],
          useCases: [],
          versionSummary: `초안 ${versionLabel}`,
        },
      },
    },
    include: packDetailInclude,
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_CREATE,
    entityType: "KnowledgePack",
    entityId: pack.packId,
    metadata: { providerProfileId: profile.id },
  });

  return { pack: toProviderPackDetail(pack) };
}

export async function getProviderPackForClient(
  clientId: string,
  packId: string,
): Promise<ProviderPackDetailDto | null> {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

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

async function mapProviderPackDetailWithValidation(
  pack: NonNullable<Awaited<ReturnType<typeof prisma.knowledgePack.findFirst>>> & {
    versions: (import("@prisma/client").KnowledgePackVersion & {
      sourceDocuments: import("@prisma/client").SourceDocument[];
    })[];
  },
) {
  const docIds = pack.versions.flatMap((v) => v.sourceDocuments.map((d) => d.id));
  const reports = await loadLatestReportsByDocumentIds(docIds);
  const overlays: Record<string, ProviderSourceDocumentValidationOverlay> = {};
  for (const [id, report] of Object.entries(reports)) {
    overlays[id] = {
      validationScore: report.score,
      blockingIssueCount: report.blockingIssueCount,
      warningIssueCount: report.warningIssueCount,
      validationIssues: report.issues.slice(0, 10).map((issue) => ({
        severity: issue.severity,
        code: issue.code,
        message: issue.message,
        field: issue.field,
        hint: issue.hint,
      })),
    };
  }
  const structureQuality = await loadStructureQualitySummaryForPack(pack.packId);
  const chunkQuality = await loadChunkQualitySummaryForPack(pack.packId);

  return toProviderPackDetail(pack, overlays, {
    structureTemplateKey: pack.structureTemplateKey,
    structureQuality,
    chunkQuality,
  });
}

export async function updateProviderPackForClient(
  clientId: string,
  packId: string,
  input: UpdateProviderPackInput,
) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

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

  if (input.categoryId) {
    if (!(await assertCategoryExists(input.categoryId.trim()))) {
      return { error: "CATEGORY_NOT_FOUND" as const };
    }
  }

  const data: {
    name?: string;
    categoryId?: string;
    shortDescription?: string;
    description?: string;
    tags?: string[];
    icon?: string;
    pricing?: PackPricing;
  } = {};

  if (input.name !== undefined) data.name = input.name.trim();
  if (input.categoryId !== undefined) data.categoryId = input.categoryId.trim();
  if (input.shortDescription !== undefined) data.shortDescription = input.shortDescription.trim();
  if (input.description !== undefined) data.description = input.description.trim();
  if (input.tags !== undefined) data.tags = input.tags.map((t) => t.trim()).filter(Boolean);
  if (input.icon !== undefined) data.icon = input.icon.trim() || "📦";
  if (input.pricing !== undefined) data.pricing = input.pricing;

  await prisma.knowledgePack.update({
    where: { packId },
    data,
  });

  const latestVersion = pack.versions[0];
  if (latestVersion) {
    const versionData: {
      overview?: string;
      features?: string[];
      includedKnowledge?: string[];
      supportedEnvironments?: string[];
      targetUsers?: string[];
      useCases?: string[];
      versionSummary?: string;
    } = {};

    if (input.versionOverview !== undefined) versionData.overview = input.versionOverview.trim();
    if (input.versionFeatures !== undefined) versionData.features = input.versionFeatures;
    if (input.versionIncludedKnowledge !== undefined) {
      versionData.includedKnowledge = input.versionIncludedKnowledge;
    }
    if (input.versionSupportedEnvironments !== undefined) {
      versionData.supportedEnvironments = input.versionSupportedEnvironments;
    }
    if (input.versionTargetUsers !== undefined) versionData.targetUsers = input.versionTargetUsers;
    if (input.versionUseCases !== undefined) versionData.useCases = input.versionUseCases;
    if (input.versionSummary !== undefined) versionData.versionSummary = input.versionSummary.trim();

    if (Object.keys(versionData).length > 0) {
      await prisma.knowledgePackVersion.update({
        where: { id: latestVersion.id },
        data: versionData,
      });
    }
  }

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: packId,
  });

  const updated = await getProviderPackForClient(clientId, packId);
  return { pack: updated! };
}

export async function createProviderPackVersionForClient(
  clientId: string,
  packId: string,
  input: CreatePackVersionInput,
) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

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

  const version = input.version.trim();
  if (!version) {
    return { error: "VALIDATION" as const, message: "버전이 필요합니다." };
  }

  const duplicate = await prisma.knowledgePackVersion.findUnique({
    where: { packId_version: { packId, version } },
  });

  if (duplicate) {
    return { error: "VERSION_EXISTS" as const };
  }

  await prisma.knowledgePackVersion.create({
    data: {
      packId,
      version,
      overview: input.overview?.trim() || pack.shortDescription,
      features: input.features ?? [],
      includedKnowledge: input.includedKnowledge ?? [],
      supportedEnvironments: input.supportedEnvironments ?? [],
      targetUsers: input.targetUsers ?? [],
      useCases: input.useCases ?? [],
      versionSummary: input.versionSummary?.trim() || version,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_VERSION_CREATE,
    entityType: "KnowledgePack",
    entityId: packId,
    metadata: { version },
  });

  const detail = await getProviderPackForClient(clientId, packId);
  return { pack: detail! };
}

export async function createSourceDocumentForProviderPack(
  clientId: string,
  packId: string,
  input: CreateSourceDocumentInput,
) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

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

  const detail = await getProviderPackForClient(clientId, packId);
  return { pack: detail! };
}

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

async function recordSubmitForReviewPipeline(
  packId: string,
  clientId: string,
  note: string | null,
) {
  const targetStatus = PipelineStatus.REVIEWING;
  const triggerType = "SUBMIT_FOR_REVIEW";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: clientId,
      steps: [PipelineStatus.READY_FOR_REVIEW, PipelineStatus.REVIEWING],
    });

    if ("runId" in run) {
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.READY_FOR_REVIEW,
        status: "PASS",
        message: note ?? "검토 준비 완료",
      });
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.REVIEWING,
        status: "PASS",
        message: "관리자 검토 대기열에 등록",
      });
      await finishPipelineRun({
        runId: run.runId,
        status: "PASS",
        summary: "검수 요청 제출 완료",
      });
    } else {
      logPipelineRecordFailure("recordSubmitForReviewPipeline", {
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
      logPipelineRecordFailure("recordSubmitForReviewPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordSubmitForReviewPipeline", {
      packId,
      triggerType,
      targetStatus,
      error,
    });
  }
}

export async function submitProviderPackForReview(clientId: string, packId: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
    include: {
      versions: {
        include: { sourceDocuments: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND" as const };
  }

  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_DRAFT" as const };
  }

  if (!pack.categoryId || !pack.shortDescription.trim() || !pack.description.trim()) {
    return { error: "INCOMPLETE" as const, message: "카테고리와 설명을 확인해 주세요." };
  }

  if (pack.versions.length === 0) {
    return { error: "INCOMPLETE" as const, message: "버전이 최소 1개 필요합니다." };
  }

  const allDocs = pack.versions.flatMap((v) => v.sourceDocuments);
  const hasSourceDocument = allDocs.length > 0;
  if (!hasSourceDocument) {
    return {
      error: "INCOMPLETE" as const,
      message: "원천 문서(SourceDocument)를 최소 1개 등록해 주세요.",
    };
  }

  const validationStatuses = allDocs.map((d) => d.validationStatus);
  const validationCounts = countSourceValidationFromStatuses(validationStatuses);

  if (!meetsSourceValidationSubmitGate(validationCounts)) {
    if (validationCounts.failCount > 0) {
      return {
        error: "INCOMPLETE" as const,
        message:
          "검증에 실패(FAIL)한 원천 문서가 있어 제출할 수 없습니다. 해당 문서를 수정해 주세요.",
      };
    }
    return {
      error: "INCOMPLETE" as const,
      message:
        "검증되지 않은(NOT_CHECKED) 원천 문서가 있어 제출할 수 없습니다. 원천 문서를 다시 등록하거나 검증 상태를 갱신해 주세요.",
    };
  }

  const structureQuality = await loadStructureQualitySummaryForPack(packId);
  const structureGate = structureQualityGateSnapshotFromSummary(structureQuality);
  if (!meetsStructureQualityGate(structureGate)) {
    const message = getStructureQualityBlockingMessage(structureGate, structureQuality);
    return {
      error: "INCOMPLETE" as const,
      message: message ?? "구조/품질 점검을 먼저 실행해 주세요.",
    };
  }

  const chunkQuality = await loadChunkQualitySummaryForPack(packId);
  const chunkGate = chunkQualityGateSnapshotFromSummary(chunkQuality);
  if (!meetsChunkQualityGate(chunkGate)) {
    const message = getChunkQualityBlockingMessage(chunkGate, chunkQuality);
    return {
      error: "INCOMPLETE" as const,
      message: message ?? "청킹 품질 점검을 먼저 실행해 주세요.",
    };
  }

  const onlyEtc = allDocs.every((d) => d.sourceType === "ETC");
  const submitNote = onlyEtc
    ? "모든 원천 문서 유형이 '기타(ETC)'입니다. 자료 유형을 구체적으로 분류하면 검수 품질이 향상됩니다."
    : null;

  await prisma.$transaction([
    prisma.knowledgePack.update({
      where: { packId },
      data: { status: PackStatus.REVIEWING },
    }),
    prisma.packReview.create({
      data: {
        packId,
        status: "PENDING",
      },
    }),
  ]);

  await recordSubmitForReviewPipeline(packId, clientId, submitNote);

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_SUBMIT,
    entityType: "KnowledgePack",
    entityId: packId,
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_REVIEW_CREATE,
    entityType: "PackReview",
    entityId: packId,
    metadata: { packId, status: "PENDING" },
  });

  const detail = await getProviderPackForClient(clientId, packId);
  return { pack: detail! };
}

export async function validateProviderSourceDocument(
  clientId: string,
  packId: string,
  sourceDocumentId: string,
) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

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

  const detail = await getProviderPackForClient(clientId, packId);
  return { pack: detail!, report: validation.report };
}

export async function evaluateProviderPackStructureQuality(clientId: string, packId: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

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

  const detail = await getProviderPackForClient(clientId, packId);
  return { pack: detail!, evaluation: result };
}

export async function evaluateProviderPackChunkQuality(clientId: string, packId: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { clientId },
  });

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

  const detail = await getProviderPackForClient(clientId, packId);
  return { pack: detail!, evaluation: result };
}
