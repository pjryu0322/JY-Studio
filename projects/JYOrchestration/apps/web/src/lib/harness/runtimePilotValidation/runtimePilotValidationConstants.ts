/**
 * Pilot Validation Phase 0 — read-only chain validation constants.
 */

import { RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED } from "@/lib/harness/runtimeControlledPilotExecutionCandidate/runtimeControlledPilotExecutionCandidateConstants";

export const RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS_DISABLED =
  RUNTIME_CONTROLLED_PILOT_EXECUTION_CANDIDATE_ACTUAL_FLAGS_DISABLED;

export const SERIALIZED_RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS = {
  ...RUNTIME_PILOT_VALIDATION_ACTUAL_FLAGS_DISABLED,
};

export const PILOT_VALIDATION_PROHIBITED_OPERATION_ROWS_KO = [
  "실제 소스 변경 없음",
  "Git Push 없음",
  "PR Merge 없음",
  "배포 없음",
  "DB 변경 없음",
  "실제 runner 실행 없음",
  "실제 adapter/sandbox invocation 없음",
] as const;
