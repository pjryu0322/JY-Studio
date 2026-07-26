import { prisma } from "@/lib/prisma";
import { PACK_ID_PATTERN } from "@/lib/pack-id-generator";
import { loadStructureQualitySummaryForPack } from "@/lib/structure-quality/structure-quality-freshness";
import { loadChunkQualitySummaryForPack } from "@/lib/chunk-quality/chunk-quality-freshness";
import { loadRetrievalEvaluationSummaryForPack } from "@/lib/retrieval-evaluation/retrieval-evaluation-freshness";
import { loadReleaseGateSummaryForPack } from "@/lib/release-gate/release-gate-service";
import { loadLatestReportsByDocumentIds } from "@/lib/source-validation/source-validation-report-service";
import {
  toProviderPackDetail,
  type ProviderSourceDocumentValidationOverlay,
} from "@/lib/provider-pack-dto";
import type { ResolvedCreateProviderPackInput } from "@/lib/provider-pack/provider-pack-types";
import { isProviderRejectionAcknowledged } from "@/lib/pack-review-rejection-ack";
import { resolveProviderAdminGenerationHold } from "@/lib/python-worker/worker-zip-import-provider-service";
import { resolveStoreWorkflowMarkers } from "@/lib/store-workflow-markers";

export const packDetailInclude = {
  versions: {
    orderBy: { createdAt: "desc" as const },
    include: {
      sourceDocuments: {
        orderBy: { createdAt: "desc" as const },
      },
    },
  },
} as const;

export function validateCreatePackInput(input: ResolvedCreateProviderPackInput): string | null {
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

export async function assertCategoryExists(categoryId: string) {
  const category = await prisma.packCategory.findUnique({
    where: { categoryId },
  });
  return Boolean(category);
}

export async function mapProviderPackDetailWithValidation(
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
    select: { rejectionReason: true, submitSnapshot: true },
  });
  const latestOpenReview = await prisma.packReview.findFirst({
    where: {
      packId: pack.packId,
      status: { in: ["PENDING", "IN_REVIEW"] },
    },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });
  const adminGenerationHold = await resolveProviderAdminGenerationHold(pack.packId);
  const workflowMarkers = await resolveStoreWorkflowMarkers(pack.packId);

  return toProviderPackDetail(pack, overlays, {
    structureTemplateKey: pack.structureTemplateKey,
    structureQuality,
    chunkQuality,
    retrievalEvaluation,
    releaseGate,
    latestRejectionReason: latestRejected?.rejectionReason ?? null,
    latestRejectionAcknowledged: latestRejected
      ? isProviderRejectionAcknowledged(latestRejected.submitSnapshot)
      : true,
    latestReviewStatus: latestOpenReview?.status ?? null,
    adminGenerationHold,
    providerReviewPhase: workflowMarkers.providerReviewPhase,
    providerChangesRequest: workflowMarkers.providerChangesRequest,
    providerSupplement: workflowMarkers.providerSupplement,
    providerSupplementPhase: workflowMarkers.providerSupplementPhase,
  });
}
