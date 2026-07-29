import type {
  CorrectionAuditEvent,
  CorrectionCase,
  CorrectionRequestedAction,
  CorrectionTargetType,
} from "@prisma/client";
import type {
  CorrectionAuditEventDto,
  CorrectionCaseDto,
  CorrectionWorkbenchSummaryDto,
} from "@/lib/correction/correction-types";

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function availableActionsForTarget(
  targetType: CorrectionTargetType,
): CorrectionRequestedAction[] {
  if (targetType === "FILE") return ["FILE_EXCLUDE", "FILE_REQUEST_PROVIDER"];
  if (targetType === "STRUCTURE") return ["STRUCTURE_DELETE", "STRUCTURE_MERGE"];
  return ["CHUNK_DELETE", "CHUNK_MERGE"];
}

export function nextWorkForCase(status: CorrectionCase["status"]): string {
  switch (status) {
    case "OPEN":
      return "보정 액션 적용";
    case "APPLIED":
      return "재생성 실행";
    case "REGENERATED":
      return "품질·Outcome 확인 후 검증";
    case "VERIFIED":
      return "케이스 종료";
    case "CLOSED":
      return "완료";
    default:
      return "상태 확인";
  }
}

export function toCorrectionCaseDto(row: CorrectionCase): CorrectionCaseDto {
  return {
    id: row.id,
    packId: row.packId,
    versionId: row.versionId,
    targetType: row.targetType,
    targetId: row.targetId,
    secondaryTargetId: row.secondaryTargetId,
    issueCode: row.issueCode,
    severity: row.severity,
    title: row.title,
    description: row.description,
    sourceLocation: row.sourceLocation,
    contentPreview: row.contentPreview,
    recommendedAction: row.recommendedAction,
    status: row.status,
    generationRunId: row.generationRunId,
    searchIndexGenerationId: row.searchIndexGenerationId,
    inventoryItemId: row.inventoryItemId,
    relativePath: row.relativePath,
    parameters: asRecord(row.parameters),
    appliedAt: toIso(row.appliedAt),
    appliedByUserId: row.appliedByUserId,
    regeneratedAt: toIso(row.regeneratedAt),
    verifiedAt: toIso(row.verifiedAt),
    closedAt: toIso(row.closedAt),
    closedByUserId: row.closedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    availableActions: availableActionsForTarget(row.targetType),
    nextAction: nextWorkForCase(row.status),
  };
}

export function toCorrectionAuditEventDto(row: CorrectionAuditEvent): CorrectionAuditEventDto {
  return {
    id: row.id,
    caseId: row.caseId,
    actorUserId: row.actorUserId,
    action: row.action,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    detail: asRecord(row.detail),
    createdAt: row.createdAt.toISOString(),
  };
}

export function buildWorkbenchSummary(input: {
  packId: string;
  versionId: string | null;
  cases: readonly CorrectionCase[];
}): CorrectionWorkbenchSummaryDto {
  const counts = {
    openCount: 0,
    appliedCount: 0,
    regeneratedCount: 0,
    verifiedCount: 0,
    closedCount: 0,
    blockerCount: 0,
    warningCount: 0,
  };
  for (const row of input.cases) {
    if (row.status === "OPEN") counts.openCount += 1;
    else if (row.status === "APPLIED") counts.appliedCount += 1;
    else if (row.status === "REGENERATED") counts.regeneratedCount += 1;
    else if (row.status === "VERIFIED") counts.verifiedCount += 1;
    else if (row.status === "CLOSED") counts.closedCount += 1;
    if (row.severity === "BLOCKER") counts.blockerCount += 1;
    else counts.warningCount += 1;
  }

  let currentStatus = "예외 없음";
  let nextWork = "제공자 검토 또는 서비스 검증으로 진행";
  if (counts.openCount > 0) {
    currentStatus = "보정 대기";
    nextWork = "차단·주의 예외에 보정 액션 적용";
  } else if (counts.appliedCount > 0) {
    currentStatus = "보정 적용됨";
    nextWork = "재생성 → Auto Quality → Outcome 갱신";
  } else if (counts.regeneratedCount > 0) {
    currentStatus = "재생성·품질 반영됨";
    nextWork = "검증 후 케이스 종료";
  } else if (counts.verifiedCount > 0) {
    currentStatus = "검증 완료";
    nextWork = "케이스 종료";
  }

  return {
    packId: input.packId,
    versionId: input.versionId,
    ...counts,
    currentStatus,
    nextWork,
  };
}
