import type { CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import {
  findAuthoritativeLatestRunForCodeTask,
  mapAuthoritativeOutcomeToVerificationDisplayStatus,
  resolveAuthoritativeCodeTaskOutcome,
} from "@/lib/prototype/implementationCodeTaskOutcomeResolver";
import {
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

export function resolveExecutionUnitVerificationDisplayStatus(input: {
  readonly unit: ImplementationExecutionUnitV1;
  readonly run: CodeTaskExecutionRunV1 | null | undefined;
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): ExecutionUnitVerificationDisplayStatusV1 {
  const runs =
    input.runs != null
      ? input.runs
      : input.run
        ? [input.run]
        : [];
  const outcome = resolveAuthoritativeCodeTaskOutcome({ unit: input.unit, runs });
  return mapAuthoritativeOutcomeToVerificationDisplayStatus(outcome.status);
}

export function buildExecutionUnitVerificationRows(input: {
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly runs: readonly CodeTaskExecutionRunV1[] | null | undefined;
}): readonly ExecutionUnitVerificationRowV1[] {
  const runs = input.runs ?? [];
  return input.units.map((unit) => {
    const run = findAuthoritativeLatestRunForCodeTask(runs, unit.codeTaskId);
    return {
      unitId: unit.unitId,
      codeTaskId: unit.codeTaskId,
      displayStatus: resolveExecutionUnitVerificationDisplayStatus({ unit, run, runs }),
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

/** CodeTask tree card — aligned with summary persisted-outcome gate. */
export function formatExecutionUnitVerificationCardLabels(
  displayStatus: ExecutionUnitVerificationDisplayStatusV1,
): Readonly<{ readonly statusLabel: string; readonly progressLabel: string }> {
  switch (displayStatus) {
    case "verified":
      return { statusLabel: "완료", progressLabel: "GitHub commit 확인됨" };
    case "verification_inconsistent":
      return {
        statusLabel: "검증 완료 대기",
        progressLabel: "GitHub 작업 결과 저장 중",
      };
    case "in_progress":
      return { statusLabel: "검증 중", progressLabel: "실행 중 또는 GitHub 확인 중" };
    case "failed":
      return { statusLabel: "실패", progressLabel: "다시 실행 필요" };
    case "skipped":
      return { statusLabel: "건너뜀", progressLabel: "선택에서 제외됨" };
    default:
      return { statusLabel: "대기", progressLabel: "실행 가능" };
  }
}
