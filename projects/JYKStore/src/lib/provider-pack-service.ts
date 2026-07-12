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
import { generateUniquePackId, PACK_ID_PATTERN } from "@/lib/pack-id-generator";
import { deriveShortDescription } from "@/lib/pack-summary-generator";
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
import {
  countSourceValidationFromStatuses,
  meetsSourceValidationSubmitGate,
} from "@/lib/source-validation-readiness";
import {
  evaluatePackStructureQuality,
} from "@/lib/structure-quality/structure-quality-evaluate-service";
import { loadStructureQualitySummaryForPack } from "@/lib/structure-quality/structure-quality-freshness";
import { evaluatePackChunkQuality } from "@/lib/chunk-quality/chunk-quality-evaluate-service";
import { regenerateAutoChunksForPack } from "@/lib/auto-pipeline/provider-auto-chunk-service";
import { runProviderReviewPreparationPipeline } from "@/lib/auto-pipeline/provider-review-preparation-service";
import { loadChunkQualitySummaryForPack } from "@/lib/chunk-quality/chunk-quality-freshness";
import {
  chunkQualityGateSnapshotFromSummary,
  getChunkQualityBlockingMessage,
  meetsChunkQualityGate,
} from "@/lib/chunk-quality/chunk-quality-readiness";
import {
  generateRetrievalEvaluationCasesForPack,
  runRetrievalEvaluationForPack,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-service";
import { loadRetrievalEvaluationSummaryForPack } from "@/lib/retrieval-evaluation/retrieval-evaluation-freshness";
import {
  getRetrievalEvaluationBlockingMessage,
  meetsRetrievalEvaluationGate,
  retrievalEvaluationGateSnapshotFromSummary,
} from "@/lib/retrieval-evaluation/retrieval-evaluation-readiness";
import { evaluateReleaseGateForPack, loadReleaseGateSummaryForPack } from "@/lib/release-gate/release-gate-service";
import { prepareProviderPackForFinalReviewSubmit } from "@/lib/auto-pipeline/provider-final-review-submit-service";
import { commitDistributionPackForReview } from "@/lib/distribution/distribution-submit-service";
import { refreshDistributionManifest } from "@/lib/distribution/distribution-manifest-service";
import { buildProviderReviewSubmitSnapshot } from "@/lib/provider-review-submit-snapshot";
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

export type CreateProviderPackInput = {
  packId?: string;
  name: string;
  categoryId: string;
  shortDescription?: string;
  description: string;
  tags?: string[];
  version?: string;
};

type ResolvedCreateProviderPackInput = {
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

function validateCreatePackInput(input: ResolvedCreateProviderPackInput): string | null {
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

export async function listProviderPacksForClient(userId: string, clientId: string) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

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
  userId: string,
  clientId: string,
  input: CreateProviderPackInput,
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const name = input.name.trim();
  const categoryId = input.categoryId.trim();
  const description = input.description.trim();

  const category = await prisma.packCategory.findUnique({
    where: { categoryId },
  });
  if (!category) {
    return { error: "CATEGORY_NOT_FOUND" as const };
  }

  const explicitPackId = input.packId?.trim();
  let packId = explicitPackId || (await generateUniquePackId(name));
  const shortDescription =
    input.shortDescription?.trim() ||
    deriveShortDescription({
      name,
      description,
      fallbackCategoryName: category.name,
    });

  const validationMessage = validateCreatePackInput({
    packId,
    name,
    categoryId,
    shortDescription,
    description,
    tags: input.tags,
    version: input.version,
  });
  if (validationMessage) {
    return { error: "VALIDATION" as const, message: validationMessage };
  }

  let existing = await prisma.knowledgePack.findUnique({ where: { packId } });
  if (existing) {
    if (explicitPackId) {
      return { error: "PACK_ID_EXISTS" as const };
    }
    packId = await generateUniquePackId(name);
    existing = await prisma.knowledgePack.findUnique({ where: { packId } });
    if (existing) {
      return { error: "PACK_ID_EXISTS" as const };
    }
  }
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

  return { ok: true, packId: pack.packId, status: pack.status };
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
  const retrievalEvaluation = await loadRetrievalEvaluationSummaryForPack(pack.packId);
  const releaseGate = await loadReleaseGateSummaryForPack(pack.packId);
  const latestRejected = await prisma.packReview.findFirst({
    where: { packId: pack.packId, decision: "REJECT" },
    orderBy: { decidedAt: "desc" },
    select: { rejectionReason: true },
  });
  const latestOpenReview = await prisma.packReview.findFirst({
    where: {
      packId: pack.packId,
      status: { in: ["PENDING", "IN_REVIEW"] },
    },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });

  return toProviderPackDetail(pack, overlays, {
    structureTemplateKey: pack.structureTemplateKey,
    structureQuality,
    chunkQuality,
    retrievalEvaluation,
    releaseGate,
    latestRejectionReason: latestRejected?.rejectionReason ?? null,
    latestReviewStatus: latestOpenReview?.status ?? null,
  });
}

export async function updateProviderPackForClient(
  userId: string,
  clientId: string,
  packId: string,
  input: UpdateProviderPackInput,
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

    await refreshDistributionManifest({
      packId,
      versionId: latestVersion.id,
      reason: "pack_basic_info_updated",
    });
  }

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: packId,
  });

  const updated = await getProviderPackForClient(userId, clientId, packId);
  return { pack: updated! };
}

export async function createProviderPackVersionForClient(
  userId: string,
  clientId: string,
  packId: string,
  input: CreatePackVersionInput,
) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

  if (!profile) {
    return { error: "PROFILE_REQUIRED" as const };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
    include: {
      versions: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
    },
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

  const latest = pack.versions[0];
  await prisma.knowledgePackVersion.create({
    data: {
      packId,
      version,
      overview: input.overview?.trim() || latest?.overview || pack.shortDescription,
      features: input.features ?? latest?.features ?? [],
      includedKnowledge: input.includedKnowledge ?? latest?.includedKnowledge ?? [],
      supportedEnvironments:
        input.supportedEnvironments ?? latest?.supportedEnvironments ?? [],
      targetUsers: input.targetUsers ?? latest?.targetUsers ?? [],
      useCases: input.useCases ?? latest?.useCases ?? [],
      versionSummary: input.versionSummary?.trim() || latest?.versionSummary || version,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_VERSION_CREATE,
    entityType: "KnowledgePack",
    entityId: packId,
    metadata: { version },
  });

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail! };
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

export async function submitProviderPackForReview(userId: string, clientId: string, packId: string) {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);

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

  const latestVersionId = pack.versions[0]?.id;
  const distributionPayload = latestVersionId
    ? await prisma.knowledgePayload.findUnique({ where: { versionId: latestVersionId } })
    : null;

  if (distributionPayload) {
    const distributionResult = await commitDistributionPackForReview(userId, clientId, packId);
    if ("error" in distributionResult) {
      return distributionResult;
    }
    await recordSubmitForReviewPipeline(packId, clientId, "Distribution Payload 검수 요청");
    const detail = await getProviderPackForClient(userId, clientId, packId);
    return { pack: detail!, snapshot: distributionResult.snapshot, mode: "DISTRIBUTION" as const };
  }

  const allDocs = pack.versions.flatMap((v) => v.sourceDocuments);
  if (allDocs.length === 0) {
    return {
      error: "INCOMPLETE" as const,
      message: "원천 문서(SourceDocument)를 최소 1개 등록해 주세요.",
    };
  }

  const preparation = await prepareProviderPackForFinalReviewSubmit({
    packId,
    actorClientId: clientId,
    providerProfileId: profile.id,
  });

  if (!preparation.ok) {
    return {
      error: "INCOMPLETE" as const,
      message: preparation.message,
      preparation,
    };
  }

  const snapshot = buildProviderReviewSubmitSnapshot({
    submittedVersionId: preparation.submittedVersionId,
    sourceDocumentIds: preparation.sourceDocumentIds,
    activeChunkIds: preparation.activeChunkIds,
    retrievalEvaluationSetId: preparation.retrievalEvaluationSetId,
    retrievalEvaluationRunId: preparation.retrievalEvaluationRunId,
    releaseGateRunId: preparation.releaseGateRunId,
    releaseGateStatus: preparation.releaseGateStatus,
    retrievalEvaluationStatus: preparation.retrievalEvaluationStatus,
    warnings: preparation.warnings,
  });

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
        submitSnapshot: snapshot,
      },
    }),
  ]);

  await recordSubmitForReviewPipeline(packId, clientId, submitNote);

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_SUBMIT,
    entityType: "KnowledgePack",
    entityId: packId,
    metadata: { packId, submitSnapshot: snapshot },
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_REVIEW_CREATE,
    entityType: "PackReview",
    entityId: packId,
    metadata: { packId, status: "PENDING", submitSnapshot: snapshot },
  });

  const detail = await getProviderPackForClient(userId, clientId, packId);
  return { pack: detail!, preparation, snapshot };
}

export async function withdrawProviderPackFromReview(
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

  if (pack.status !== PackStatus.REVIEWING) {
    return { error: "NOT_REVIEWING" as const };
  }

  const pending = await prisma.packReview.findFirst({
    where: { packId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  if (!pending) {
    const accepted = await prisma.packReview.findFirst({
      where: { packId, status: "IN_REVIEW" },
      orderBy: { createdAt: "desc" },
    });
    if (accepted) {
      return { error: "ALREADY_ACCEPTED" as const };
    }
    return { error: "NO_PENDING_REVIEW" as const };
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.knowledgePack.update({
      where: { packId },
      data: { status: PackStatus.DRAFT },
    });

    await tx.packReview.update({
      where: { id: pending.id },
      data: {
        status: "WITHDRAWN",
        decision: "WITHDRAW",
        memo: "제공자가 검수 요청을 회수했습니다.",
        decidedAt: now,
      },
    });
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_UPDATE,
    entityType: "KnowledgePack",
    entityId: packId,
    metadata: { packId, action: "withdraw_review", previousStatus: "REVIEWING" },
  });

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
