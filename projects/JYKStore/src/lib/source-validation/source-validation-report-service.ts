import { PipelineStatus, type SourceDocument } from "@prisma/client";
import type { SourceValidationReportDto } from "@/lib/source-validation-dto";
import {
  completePipelineStep,
  createPipelineRun,
  finishPipelineRun,
  logPipelineRecordFailure,
  updatePackPipelineStatus,
} from "@/lib/pipeline-service";
import { prisma } from "@/lib/prisma";
import { validateSourceDocumentContent } from "@/lib/source-validation/source-validation-runner";
import type { SourceValidationRunResult } from "@/lib/source-validation/source-validation-types";

function mapReport(
  report: {
    id: string;
    sourceDocumentId: string;
    packId: string;
    versionId: string;
    sourceType: string;
    sourceFormat: string;
    status: string;
    score: number;
    summary: string;
    issueCount: number;
    blockingIssueCount: number;
    warningIssueCount: number;
    checkedBy: string;
    checkedAt: Date;
    issues: {
      id: string;
      severity: string;
      code: string;
      message: string;
      field: string | null;
      hint: string | null;
    }[];
  },
): SourceValidationReportDto {
  return {
    id: report.id,
    sourceDocumentId: report.sourceDocumentId,
    packId: report.packId,
    versionId: report.versionId,
    sourceType: report.sourceType,
    sourceFormat: report.sourceFormat,
    status: report.status,
    score: report.score,
    summary: report.summary,
    issueCount: report.issueCount,
    blockingIssueCount: report.blockingIssueCount,
    warningIssueCount: report.warningIssueCount,
    checkedBy: report.checkedBy,
    checkedAt: report.checkedAt.toISOString(),
    issues: report.issues.map((issue) => ({
      id: issue.id,
      severity: issue.severity,
      code: issue.code,
      message: issue.message,
      field: issue.field,
      hint: issue.hint,
    })),
  };
}

async function recordSourceValidationPipeline(
  packId: string,
  actorClientId: string | undefined,
  validationStatus: string,
  triggerType: string,
  options?: { pipelineSummary?: string; pipelineDetails?: Record<string, unknown> },
) {
  const targetStatus = PipelineStatus.SOURCE_VALIDATING;
  const stepStatus =
    validationStatus === "FAIL" ? "FAIL" : validationStatus === "WARNING" ? "WARNING" : "PASS";

  try {
    const run = await createPipelineRun({
      packId,
      triggerType,
      triggeredByClientId: actorClientId,
      steps: [PipelineStatus.SOURCE_VALIDATING],
    });

    if ("runId" in run) {
      await completePipelineStep({
        runId: run.runId,
        step: PipelineStatus.SOURCE_VALIDATING,
        status: stepStatus,
        message: options?.pipelineSummary ?? `원천 자료 검증 (${triggerType})`,
        details: options?.pipelineDetails ?? { validationStatus },
      });
      await finishPipelineRun({
        runId: run.runId,
        status: stepStatus,
        summary: options?.pipelineSummary ?? "원천 자료 검증 완료",
      });
    } else {
      logPipelineRecordFailure("recordSourceValidationPipeline", {
        packId,
        triggerType,
        targetStatus,
        error: run.error,
      });
    }

    const nextPackStatus =
      validationStatus === "FAIL" ? PipelineStatus.SOURCE_VALIDATING : PipelineStatus.SOURCE_REGISTERING;

    const statusUpdate = await updatePackPipelineStatus({
      packId,
      pipelineStatus: nextPackStatus,
      triggeredByClientId: actorClientId,
    });
    if ("error" in statusUpdate) {
      logPipelineRecordFailure("recordSourceValidationPipeline", {
        packId,
        triggerType,
        targetStatus: nextPackStatus,
        error: "updatePackPipelineStatus NOT_FOUND",
      });
    }
  } catch (error) {
    logPipelineRecordFailure("recordSourceValidationPipeline", {
      packId,
      triggerType,
      targetStatus,
      error,
    });
  }
}

export async function persistSourceValidationResult(input: {
  sourceDocument: SourceDocument;
  packId: string;
  result: SourceValidationRunResult;
  actorClientId?: string;
  triggerType?: string;
  recordPipeline?: boolean;
}): Promise<string> {
  const { sourceDocument, packId, result } = input;
  const triggerType = input.triggerType ?? "SOURCE_DOCUMENT_VALIDATE";
  const recordPipeline = input.recordPipeline !== false;

  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.sourceValidationReport.create({
      data: {
        sourceDocumentId: sourceDocument.id,
        packId,
        versionId: sourceDocument.versionId,
        sourceType: sourceDocument.sourceType,
        sourceFormat: sourceDocument.sourceFormat,
        status: result.status,
        score: result.score,
        summary: result.summary,
        issueCount: result.issueCount,
        blockingIssueCount: result.blockingIssueCount,
        warningIssueCount: result.warningIssueCount,
        checkedBy: "SYSTEM_RULE",
        issues: {
          create: result.issues.map((issue) => ({
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

    await tx.sourceDocument.update({
      where: { id: sourceDocument.id },
      data: {
        validationStatus: result.status,
        validationSummary: result.summary,
      },
    });

    return created;
  });

  if (recordPipeline) {
    await recordSourceValidationPipeline(packId, input.actorClientId, result.status, triggerType);
  }

  return report.id;
}

async function loadSiblingChecksums(versionId: string, excludeDocumentId?: string): Promise<string[]> {
  const docs = await prisma.sourceDocument.findMany({
    where: { versionId },
    select: { id: true, checksum: true },
  });
  return docs
    .filter((d) => d.id !== excludeDocumentId)
    .map((d) => d.checksum?.trim())
    .filter((c): c is string => Boolean(c));
}

export async function validateAndPersistSourceDocument(
  sourceDocumentId: string,
  options?: { actorClientId?: string; triggerType?: string; recordPipeline?: boolean },
): Promise<
  | { ok: true; result: SourceValidationRunResult; report: SourceValidationReportDto }
  | { error: "NOT_FOUND" }
> {
  const doc = await prisma.sourceDocument.findUnique({
    where: { id: sourceDocumentId },
    include: { version: { select: { packId: true } } },
  });

  if (!doc) {
    return { error: "NOT_FOUND" };
  }

  const packId = doc.version.packId;
  const siblingChecksums = await loadSiblingChecksums(doc.versionId, doc.id);

  const result = validateSourceDocumentContent(
    {
      title: doc.title,
      sourceType: doc.sourceType,
      sourceFormat: doc.sourceFormat,
      content: doc.content,
      sourceUrl: doc.sourceUrl,
      productVersion: doc.productVersion,
      checksum: doc.checksum,
    },
    { packId, versionId: doc.versionId, siblingChecksums },
  );

  await persistSourceValidationResult({
    sourceDocument: doc,
    packId,
    result,
    actorClientId: options?.actorClientId,
    triggerType: options?.triggerType,
    recordPipeline: options?.recordPipeline,
  });

  const report = await getLatestSourceValidationReport(sourceDocumentId);
  return { ok: true, result, report: report! };
}

export async function validateAllSourceDocumentsForPack(
  packId: string,
  options?: { actorClientId?: string },
): Promise<{ validatedCount: number; reports: SourceValidationReportDto[] }> {
  const docs = await prisma.sourceDocument.findMany({
    where: { version: { packId } },
    select: { id: true },
  });

  const reports: SourceValidationReportDto[] = [];
  let passCount = 0;
  let warningCount = 0;
  let failCount = 0;

  for (const doc of docs) {
    const res = await validateAndPersistSourceDocument(doc.id, {
      actorClientId: options?.actorClientId,
      triggerType: "SOURCE_DOCUMENT_VALIDATE_ALL",
      recordPipeline: false,
    });
    if (!("error" in res)) {
      reports.push(res.report);
      if (res.result.status === "FAIL") {
        failCount += 1;
      } else if (res.result.status === "WARNING") {
        warningCount += 1;
      } else {
        passCount += 1;
      }
    }
  }

  const total = reports.length;
  let aggregateStatus = "PASS";
  if (failCount > 0) {
    aggregateStatus = "FAIL";
  } else if (warningCount > 0) {
    aggregateStatus = "WARNING";
  }

  const pipelineSummary = `원천 자료 전체 검증 완료: total=${total}, pass=${passCount}, warning=${warningCount}, fail=${failCount}`;

  await recordSourceValidationPipeline(
    packId,
    options?.actorClientId,
    aggregateStatus,
    "SOURCE_DOCUMENT_VALIDATE_ALL",
    {
      pipelineSummary,
      pipelineDetails: {
        validationStatus: aggregateStatus,
        total,
        pass: passCount,
        warning: warningCount,
        fail: failCount,
      },
    },
  );

  return { validatedCount: reports.length, reports };
}

export async function getLatestSourceValidationReport(
  sourceDocumentId: string,
): Promise<SourceValidationReportDto | null> {
  const report = await prisma.sourceValidationReport.findFirst({
    where: { sourceDocumentId },
    orderBy: { checkedAt: "desc" },
    include: { issues: { orderBy: { createdAt: "asc" } } },
  });

  return report ? mapReport(report) : null;
}

export async function listSourceValidationReportsForPack(
  packId: string,
): Promise<SourceValidationReportDto[]> {
  const reports = await prisma.sourceValidationReport.findMany({
    where: { packId },
    orderBy: { checkedAt: "desc" },
    include: { issues: { orderBy: { createdAt: "asc" } } },
    take: 200,
  });

  return reports.map(mapReport);
}

export async function loadLatestReportsByDocumentIds(
  sourceDocumentIds: string[],
): Promise<Record<string, SourceValidationReportDto>> {
  if (sourceDocumentIds.length === 0) {
    return {};
  }

  const reports = await prisma.sourceValidationReport.findMany({
    where: { sourceDocumentId: { in: sourceDocumentIds } },
    orderBy: { checkedAt: "desc" },
    include: { issues: { orderBy: { createdAt: "asc" } } },
  });

  const out: Record<string, SourceValidationReportDto> = {};
  for (const report of reports) {
    if (!out[report.sourceDocumentId]) {
      out[report.sourceDocumentId] = mapReport(report);
    }
  }
  return out;
}

export async function loadLatestValidationSummariesByDocumentIds(
  sourceDocumentIds: string[],
): Promise<
  Record<
    string,
    { score: number; blockingIssueCount: number; warningIssueCount: number; status: string }
  >
> {
  if (sourceDocumentIds.length === 0) {
    return {};
  }

  const reports = await prisma.sourceValidationReport.findMany({
    where: { sourceDocumentId: { in: sourceDocumentIds } },
    orderBy: { checkedAt: "desc" },
    select: {
      sourceDocumentId: true,
      score: true,
      blockingIssueCount: true,
      warningIssueCount: true,
      status: true,
    },
  });

  const out: Record<
    string,
    { score: number; blockingIssueCount: number; warningIssueCount: number; status: string }
  > = {};

  for (const report of reports) {
    if (!out[report.sourceDocumentId]) {
      out[report.sourceDocumentId] = {
        score: report.score,
        blockingIssueCount: report.blockingIssueCount,
        warningIssueCount: report.warningIssueCount,
        status: report.status,
      };
    }
  }

  return out;
}
