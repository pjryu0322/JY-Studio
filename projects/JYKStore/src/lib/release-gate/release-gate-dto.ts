import type { ReleaseGateIssue, ReleaseGateStatus } from "@/lib/release-gate/release-gate-types";

export type ReleaseGateIssueDto = {
  severity: string;
  code: string;
  message: string;
  field: string | null;
  hint: string | null;
};

export type ReleaseGateRunDto = {
  id: string;
  packId: string;
  versionId: string | null;
  targetStatus: string;
  status: ReleaseGateStatus;
  blockingIssueCount: number;
  warningIssueCount: number;
  sourceStatus: string | null;
  structureStatus: string | null;
  chunkStatus: string | null;
  retrievalStatus: string | null;
  graphStatus: string | null;
  summary: string;
  checkedBy: string;
  checkedAt: string;
  issues: ReleaseGateIssueDto[];
};

export type ReleaseGateFreshnessStatus = "CURRENT" | "STALE" | "MISSING";

export type ReleaseGateFreshnessSnapshot = {
  status: ReleaseGateFreshnessStatus;
  reason: string | null;
  checkedAt: string | null;
  versionId: string | null;
};

export type ReleaseGateSummaryDto = {
  latestRun: ReleaseGateRunDto | null;
  freshness: ReleaseGateFreshnessSnapshot;
};

export function mapReleaseGateIssueDto(issue: ReleaseGateIssue): ReleaseGateIssueDto {
  return {
    severity: issue.severity,
    code: issue.code,
    message: issue.message,
    field: issue.field ?? null,
    hint: issue.hint ?? null,
  };
}
