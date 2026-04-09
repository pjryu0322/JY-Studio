/**
 * Validation and staleness evaluation for Business Execution preparation (derived state).
 *
 * Callers pass snapshots/handoff context; results inform whether the pipeline may advance. Not used for
 * Stage1/Stage2 procedure tests.
 */

export {
  validateActiveExecutionInput,
  type LaunchReadinessResult,
} from "@/lib/workflow/preExecutionValidation";

export {
  evaluateHandoffValidity,
  evaluateSnapshotStaleness,
  type HandoffValidityResult,
  type SnapshotStalenessResult,
} from "@/lib/workflow/preExecutionStaleness";
