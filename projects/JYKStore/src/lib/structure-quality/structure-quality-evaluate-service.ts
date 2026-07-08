import { PipelineStatus, type PipelineStepStatus } from "@prisma/client";
import type {
  KnowledgeQualityReportDto,
  StructureCoverageReportDto,
} from "@/lib/structure-quality/structure-quality-dto";
import { runKnowledgeQuality } from "@/lib/structure-quality/knowledge-quality-runner";
import { runStructureCoverage } from "@/lib/structure-quality/structure-coverage-runner";
import { selectStructureTemplateKey } from "@/lib/structure-quality/structure-template-selector";
import { getStructureTemplateWithSections } from "@/lib/structure-quality/structure-template-service";
import type { StructureCoverageDocumentInput } from "@/lib/structure-quality/structure-quality-types";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  logPipelineRecordFailure,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { prisma } from "@/lib/prisma";
import { loadLatestReportsByDocumentIds } from "@/lib/source-validation/source-validation-report-service";

function stepStatusFromQualityStatus(status: string): PipelineStepStatus {
  if (status === "FAIL") return "FAIL";
  if (status === "WARNING") return "WARNING";
  return "PASS";
}

function mapCoverageReport(
  report: {
    id: string;
    packId: string;
    versionId: string;
    templateKey: string;
    status: string;
    coverageScore: number;
    requiredSectionCount: number;
    coveredRequiredCount: number;
    missingRequiredCount: number;
    optionalSectionCount: number;
    coveredOptionalCount: number;
    summary: string;
    checkedAt: Date;
    items: {
      sectionKey: string;
      title: string;
      required: boolean;
      covered: boolean;
      score: number;
      matchedDocIds: string[];
      matchedSignals: string[];
      message: string;
    }[];
  },
  templateName: string,
): StructureCoverageReportDto {
  return {
    id: report.id,
    packId: report.packId,
    versionId: report.versionId,
    templateKey: report.templateKey,
    templateName,
    status: report.status,
    coverageScore: report.coverageScore,
    requiredSectionCount: report.requiredSectionCount,
    coveredRequiredCount: report.coveredRequiredCount,
    missingRequiredCount: report.missingRequiredCount,
    optionalSectionCount: report.optionalSectionCount,
    coveredOptionalCount: report.coveredOptionalCount,
    summary: report.summary,
    checkedAt: report.checkedAt.toISOString(),
    items: report.items.map((item) => ({
      sectionKey: item.sectionKey,
      title: item.title,
      required: item.required,
      covered: item.covered,
      score: item.score,
      matchedDocIds: item.matchedDocIds,
      matchedSignals: item.matchedSignals,
      message: item.message,
    })),
  };
}

function mapQualityReport(report: {
  id: string;
  packId: string;
  versionId: string;
  status: string;
  totalScore: number;
  completenessScore: number;
  consistencyScore: number;
  sourceQualityScore: number;
  securityScore: number;
  freshnessScore: number;
  usabilityScore: number;
  blockingIssueCount: number;
  warningIssueCount: number;
  summary: string;
  checkedAt: Date;
  issues: {
    severity: string;
    code: string;
    message: string;
    field: string | null;
    hint: string | null;
  }[];
}): KnowledgeQualityReportDto {
  return {
    id: report.id,
    packId: report.packId,
    versionId: report.versionId,
    status: report.status,
    totalScore: report.totalScore,
    completenessScore: report.completenessScore,
    consistencyScore: report.consistencyScore,
    sourceQualityScore: report.sourceQualityScore,
    securityScore: report.securityScore,
    freshnessScore: report.freshnessScore,
    usabilityScore: report.usabilityScore,
    blockingIssueCount: report.blockingIssueCount,
    warningIssueCount: report.warningIssueCount,
    summary: report.summary,
    checkedAt: report.checkedAt.toISOString(),
    issues: report.issues.map((issue) => ({
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      field: issue.field,
      hint: issue.hint,
    })),
  };
}

async function recordStructureQualityPipeline(
  packId: string,
  actorClientId: string | undefined,
  structureStatus: string,
  qualityStatus: string,
) {
  const triggerType = "STRUCTURE_QUALITY_EVALUATE";
  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: actorClientId,
      steps: [PipelineStatus.STRUCTURE_VALIDATING, PipelineStatus.KNOWLEDGE_CHECKING],
    });

    if (!("runId" in run)) {
      logPipelineRecordFailure("recordStructureQualityPipeline", {
        packId,
        triggerType,
        targetStatus: PipelineStatus.STRUCTURE_VALIDATING,
        error: run.error,
      });
      return;
    }

    await completePipelineStep({
      runId: run.runId,
      step: PipelineStatus.STRUCTURE_VALIDATING,
      status: stepStatusFromQualityStatus(structureStatus),
      message: `구조 커버리지 평가: ${structureStatus}`,
      details: { status: structureStatus },
    });
    await completePipelineStep({
      runId: run.runId,
      step: PipelineStatus.KNOWLEDGE_CHECKING,
      status: stepStatusFromQualityStatus(qualityStatus),
      message: `지식 품질 평가: ${qualityStatus}`,
      details: { status: qualityStatus },
    });

    const runStatus =
      structureStatus === "FAIL" || qualityStatus === "FAIL"
        ? "FAIL"
        : structureStatus === "WARNING" || qualityStatus === "WARNING"
          ? "WARNING"
          : "PASS";

    await finishPipelineRun({
      runId: run.runId,
      status: runStatus,
      summary: `구조/품질 평가 완료 — coverage=${structureStatus}, quality=${qualityStatus}`,
    });

    const nextPackStatus =
      runStatus === "FAIL" ? PipelineStatus.STRUCTURE_VALIDATING : PipelineStatus.SOURCE_REGISTERING;

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: nextPackStatus,
      triggeredByClientId: actorClientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordStructureQualityPipeline", {
        packId,
        triggerType,
        targetStatus: nextPackStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordStructureQualityPipeline", {
      packId,
      triggerType,
      targetStatus: PipelineStatus.STRUCTURE_VALIDATING,
      error,
    });
  }
}

export async function getLatestStructureCoverageReport(
  packId: string,
): Promise<StructureCoverageReportDto | null> {
  const report = await prisma.structureCoverageReport.findFirst({
    where: { packId },
    orderBy: { checkedAt: "desc" },
    include: { items: { orderBy: { sectionKey: "asc" } } },
  });
  if (!report) return null;
  const template = await getStructureTemplateWithSections(report.templateKey);
  return mapCoverageReport(report, template?.name ?? report.templateKey);
}

export async function getLatestKnowledgeQualityReport(
  packId: string,
): Promise<KnowledgeQualityReportDto | null> {
  const report = await prisma.knowledgeQualityReport.findFirst({
    where: { packId },
    orderBy: { checkedAt: "desc" },
    include: { issues: { orderBy: { createdAt: "asc" } } },
  });
  return report ? mapQualityReport(report) : null;
}

export async function evaluatePackStructureQuality(input: {
  packId: string;
  actorClientId?: string;
  structureTemplateKeyOverride?: string | null;
}): Promise<
  | {
      ok: true;
      templateKey: string;
      templateName: string;
      structureCoverage: StructureCoverageReportDto;
      knowledgeQuality: KnowledgeQualityReportDto;
    }
  | { error: "NOT_FOUND" }
  | { error: "NO_VERSION" }
> {
  const pack = await prisma.knowledgePack.findUnique({
    where: { packId: input.packId },
    include: {
      versions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sourceDocuments: true },
      },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND" };
  }

  const version = pack.versions[0];
  if (!version) {
    return { error: "NO_VERSION" };
  }

  const docs = version.sourceDocuments;
  const templateKey = selectStructureTemplateKey({
    categoryId: pack.categoryId,
    tags: pack.tags,
    sourceTypes: docs.map((d) => d.sourceType),
    explicitTemplateKey:
      input.structureTemplateKeyOverride ?? pack.structureTemplateKey ?? undefined,
  });

  if (pack.structureTemplateKey !== templateKey) {
    await prisma.knowledgePack.update({
      where: { packId: pack.packId },
      data: { structureTemplateKey: templateKey },
    });
  }

  const template = await getStructureTemplateWithSections(templateKey);
  if (!template) {
    return { error: "NOT_FOUND" };
  }

  const validationReports = await loadLatestReportsByDocumentIds(docs.map((d) => d.id));

  const docInputs: StructureCoverageDocumentInput[] = docs.map((doc) => ({
    id: doc.id,
    sourceType: doc.sourceType,
    title: doc.title,
    content: doc.content,
    sourceUrl: doc.sourceUrl,
    validationStatus: doc.validationStatus,
    productVersion: doc.productVersion,
    documentVersion: doc.documentVersion,
    checksum: doc.checksum,
    registeredAt: doc.registeredAt?.toISOString(),
    blockingIssueCount: validationReports[doc.id]?.blockingIssueCount ?? 0,
  }));

  const sections = template.sections.map((s) => ({
    sectionKey: s.sectionKey,
    title: s.title,
    required: s.required,
    weight: s.weight,
    sourceTypes: s.sourceTypes,
    keywords: s.keywords,
  }));

  const coverageResult = runStructureCoverage({
    templateKey,
    sections,
    documents: docInputs,
  });

  const qualityResult = runKnowledgeQuality({
    documents: docInputs,
    structureCoverage: coverageResult,
  });

  const coverageReport = await prisma.$transaction(async (tx) => {
    const created = await tx.structureCoverageReport.create({
      data: {
        packId: pack.packId,
        versionId: version.id,
        templateKey,
        status: coverageResult.status,
        coverageScore: coverageResult.coverageScore,
        requiredSectionCount: coverageResult.requiredSectionCount,
        coveredRequiredCount: coverageResult.coveredRequiredCount,
        missingRequiredCount: coverageResult.missingRequiredCount,
        optionalSectionCount: coverageResult.optionalSectionCount,
        coveredOptionalCount: coverageResult.coveredOptionalCount,
        summary: coverageResult.summary,
        items: {
          create: coverageResult.items.map((item) => ({
            sectionKey: item.sectionKey,
            title: item.title,
            required: item.required,
            covered: item.covered,
            score: item.score,
            matchedDocIds: item.matchedDocIds,
            matchedSignals: item.matchedSignals,
            message: item.message,
          })),
        },
      },
      include: { items: true },
    });
    return created;
  });

  const qualityReport = await prisma.$transaction(async (tx) => {
    const created = await tx.knowledgeQualityReport.create({
      data: {
        packId: pack.packId,
        versionId: version.id,
        status: qualityResult.status,
        totalScore: qualityResult.totalScore,
        completenessScore: qualityResult.completenessScore,
        consistencyScore: qualityResult.consistencyScore,
        sourceQualityScore: qualityResult.sourceQualityScore,
        securityScore: qualityResult.securityScore,
        freshnessScore: qualityResult.freshnessScore,
        usabilityScore: qualityResult.usabilityScore,
        blockingIssueCount: qualityResult.blockingIssueCount,
        warningIssueCount: qualityResult.warningIssueCount,
        summary: qualityResult.summary,
        issues: {
          create: qualityResult.issues.map((issue) => ({
            severity: issue.severity,
            code: issue.code,
            message: issue.message,
            field: issue.field ?? null,
            hint: issue.hint ?? null,
          })),
        },
      },
      include: { issues: true },
    });
    return created;
  });

  await recordStructureQualityPipeline(
    pack.packId,
    input.actorClientId,
    coverageResult.status,
    qualityResult.status,
  );

  return {
    ok: true,
    templateKey,
    templateName: template.name,
    structureCoverage: mapCoverageReport(coverageReport, template.name),
    knowledgeQuality: mapQualityReport(qualityReport),
  };
}
