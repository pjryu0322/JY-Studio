import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import { isCodeTaskCompletedForSummary } from "@/lib/prototype/implementationCodeTaskSummary";
import {
  isExecutionUnitInFlight,
  type ImplementationExecutionUnitV1,
} from "@/lib/prototype/implementationExecutionUnit";

/** UI / summary display — cross-checks unit.status with persisted GitHub outcome on runs. */
export type ExecutionUnitVerificationDisplayStatusV1 =
  | "pending"
  | "in_progress"
  | "verified"
  | "verification_inconsistent"
  | "failed"
  | "skipped";

export type ExecutionUnitVerificationRowV1 = Readonly<{
  readonly unitId: string;
  readonly codeTaskId: string;
  readonly displayStatus: ExecutionUnitVerificationDisplayStatusV1;
}>;

function unitClaimsVerified(unit: ImplementationExecutionUnitV1): boolean {
  return unit.status === "verified";
}

function runHasPersistedVerifiedOutcome(run: CodeTaskExecutionRunV1 | null | undefined): boolean {
  return isCodeTaskCompletedForSummary(run);
}

export function resolveExecutionUnitVerificationDisplayStatus(input: {
  readonly unit: ImplementationExecutionUnitV1;
  readonly run: CodeTaskExecutionRunV1 | null | undefined;
}): ExecutionUnitVerificationDisplayStatusV1 {
  const unit = input.unit;
  const run = input.run;
  const unitVerified = unitClaimsVerified(unit);
  const outcomeVerified = runHasPersistedVerifiedOutcome(run);

  if (unitVerified && outcomeVerified) return "verified";
  if (unitVerified !== outcomeVerified) return "verification_inconsistent";
  if (unit.status === "skipped" || run?.status === "skipped_by_user") return "skipped";
  if (unit.status === "failed") return "failed";
  if (isExecutionUnitInFlight(unit.status) || unit.status === "verifying") return "in_progress";
  if (run && !outcomeVerified && (run.status === "github_verifying" || run.status === "cursor_running")) {
    return "in_progress";
  }
  return "pending";
}

export function buildExecutionUnitVerificationRows(input: {
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
}): readonly ExecutionUnitVerificationRowV1[] {
  return input.units.map((unit) => {
    const run = findLatestRunForCodeTask(input.runs, unit.codeTaskId);
    return {
      unitId: unit.unitId,
      codeTaskId: unit.codeTaskId,
      displayStatus: resolveExecutionUnitVerificationDisplayStatus({ unit, run }),
    };
  });
}

/** Summary / queue completion — requires both unit verified and persisted GitHub outcome. */
export function isExecutionUnitCompletedForSummary(input: {
  readonly unit: ImplementationExecutionUnitV1;
  readonly run: CodeTaskExecutionRunV1 | null | undefined;
}): boolean {
  return resolveExecutionUnitVerificationDisplayStatus(input) === "verified";
}

export function isExecutionUnitSkippedForSummary(input: {
  readonly unit: ImplementationExecutionUnitV1;
  readonly run: CodeTaskExecutionRunV1 | null | undefined;
}): boolean {
  return resolveExecutionUnitVerificationDisplayStatus(input) === "skipped";
}

export function formatExecutionUnitVerificationLabel(input: {
  readonly processTaskId: string;
  readonly displayStatus: ExecutionUnitVerificationDisplayStatusV1;
}): string {
  const id = input.processTaskId.trim() || "CodeTask";
  switch (input.displayStatus) {
    case "verified":
      return `${id} 완료`;
    case "verification_inconsistent":
      return `${id} 검증 불일치`;
    case "in_progress":
      return `${id} 검증 중`;
    case "failed":
      return `${id} 실패`;
    case "skipped":
      return `${id} 건너뜀`;
    default:
      return `${id} 대기`;
  }
}
