/**
 * Planning-originated execution — **application-facing** contracts (no HTTP/DB).
 *
 * **What this is for:** future UI/API should integrate with
 * {@link import("../usecases/mvpRunPlanningOriginatedExecutionUseCase").mvpRunPlanningOriginatedExecutionUseCase}
 * and these result types — not with raw `executionBridge` / preparation bundle builders directly.
 *
 * **Orchestrated chain (internal, unchanged):**
 * planning pipeline → planning handoff → execution preparation → execution bridge → guarded start
 * (`mvpStartExecutionFromPreparationUseCase`).
 *
 * **Terminal `status` values on {@link PlanningOriginatedExecutionResult}:**
 * - `BLOCKED` — planning or preparation cannot proceed; no execution preparation for UX “start”.
 * - `NEEDS_CONFIRMATION` — planning stopped for human confirmation; no execution preparation.
 * - `READY_FOR_EXECUTION` — preparation succeeded; `PREPARE_ONLY` mode; caller may start later via the same guarded path.
 * - `EXECUTION_STARTED` — guarded bridge start succeeded (`runId` present).
 * - `EXECUTION_START_FAILED` — preparation succeeded but guarded start returned an error.
 *
 * For a named outward status type and HTTP-ready envelopes, use
 * {@link import("../contracts/planningOriginatedExecutionResponse").PlanningOriginatedExecutionStatus}.
 *
 * This layer is **orchestration-only**, not an execution engine and not a replacement for `executionService`.
 */

import type { PrepareRequirementRefinementDecisionResult } from "../planning/requirementInput/prepareRequirementRefinementDecision";
import type { PipelineStatus } from "../pipeline/pipelineTypes";
import type { ExecutionBridgeStartResult } from "../executionBridge/executionBridgeContracts";
import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";

export type PlanningOriginatedExecutionMode = "PREPARE_ONLY" | "PREPARE_AND_START";

/** Compact readiness slice mirrored from planning view model when present. */
export type PlanningOriginatedReadinessSummary = {
  readonly isReady: boolean;
  readonly blockingIssueCount: number;
  readonly confirmRequiredCount: number;
  readonly autoResolvedCount: number;
};

/** Planning-phase summary for terminal non-execution outcomes (no preparation preview). */
export type PlanningOriginatedExecutionPlanningSummary = {
  readonly projectId: string;
  readonly planningStatus: PipelineStatus | undefined;
  readonly readiness: PlanningOriginatedReadinessSummary | null;
  readonly pipelineErrors: readonly string[];
  readonly executedStepCount: number;
  /** Stable gate/stop hint (legacy early-stop string or null). */
  readonly stopHint: string | null;
};

/**
 * Compact cross-phase preview once execution preparation succeeded.
 * No raw {@link ExecutionPreparationBundle} — only counts, ids, and summaries safe for UI.
 */
export type PlanningOriginatedExecutionPreview = {
  readonly projectId: string;
  readonly planningStatus: PipelineStatus | undefined;
  readonly readiness: PlanningOriginatedReadinessSummary | null;
  readonly featureCount: number;
  readonly screenCount: number;
  readonly taskCount: number;
  /** When this preview exists, preparation already passed the confirmation gate (always false here). */
  readonly requiresConfirmation: boolean;
  readonly blockingReason?: string;
  readonly taskIdsOrdered: readonly string[];
};

export type PlanningOriginatedExecutionInput =
  | { readonly projectId: string; readonly inputText: string; readonly mode: PlanningOriginatedExecutionMode }
  | {
      readonly projectId: string;
      readonly refinement: PrepareRequirementRefinementDecisionResult;
      readonly mode: PlanningOriginatedExecutionMode;
    };

/**
 * Discriminated union: `ok` aligns with terminal success vs failure semantics for each `status`.
 * No branch mixes `planningSummary` with `preview`; no internal bundle types.
 */
export type PlanningOriginatedExecutionResult =
  | {
      readonly ok: false;
      readonly status: "BLOCKED";
      readonly reason: string;
      readonly planningSummary: PlanningOriginatedExecutionPlanningSummary;
    }
  | {
      readonly ok: false;
      readonly status: "NEEDS_CONFIRMATION";
      readonly reason: string;
      readonly planningSummary: PlanningOriginatedExecutionPlanningSummary;
    }
  | {
      readonly ok: true;
      readonly status: "READY_FOR_EXECUTION";
      readonly preview: PlanningOriginatedExecutionPreview;
    }
  | {
      readonly ok: true;
      readonly status: "EXECUTION_STARTED";
      readonly runId: string;
      readonly preview: PlanningOriginatedExecutionPreview;
    }
  | {
      readonly ok: false;
      readonly status: "EXECUTION_START_FAILED";
      readonly reason: string;
      readonly preview: PlanningOriginatedExecutionPreview;
    };

/**
 * Optional overrides for deterministic tests (default: production guarded start).
 */
export type PlanningOriginatedExecutionDeps = Readonly<{
  startFromPreparation?: (bundle: ExecutionPreparationBundle) => Promise<ExecutionBridgeStartResult>;
}>;
