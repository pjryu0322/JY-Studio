/**
 * **Stable application response contracts** for planning-originated execution.
 *
 * **Intended future UI/API attachment point:** route and transport layers should depend on
 * {@link PlanningOriginatedExecutionResponse} and {@link import("./planningOriginatedExecutionResponseBuilder").presentPlanningOriginatedExecutionResult},
 * not on raw {@link PlanningOriginatedExecutionResult} or internal preparation/handoff/bridge bundle shapes.
 *
 * This file is **types only** (no mapping logic). Mapping lives in `planningOriginatedExecutionResponseBuilder.ts`.
 */

import type { PlanningOriginatedExecutionResult } from "../planningOriginatedExecution/planningOriginatedExecutionContracts";
import type { PlanningOriginatedReadinessSummary } from "../planningOriginatedExecution/planningOriginatedExecutionContracts";

/**
 * Fixed outward status set — identical to the `status` discriminant on {@link PlanningOriginatedExecutionResult}.
 * Same internal terminal always carries the same outward status string.
 */
export type PlanningOriginatedExecutionStatus = PlanningOriginatedExecutionResult["status"];

/** Structural summary for confirmation UX (not localized copy); null when not applicable. */
export type PlanningOriginatedConfirmationNeededSummary = {
  readonly confirmRequiredCount: number;
  readonly blockingIssueCount: number;
} | null;

/** Planning-only slice when execution preparation did not run. */
export type PlanningOriginatedExecutionPlanningResponseSlice = {
  readonly projectId: string;
  readonly planningStatus: string | null;
  readonly pipelineErrorCount: number;
  readonly executedStepCount: number;
  readonly stopHint: string | null;
  readonly readiness: PlanningOriginatedReadinessSummary | null;
};

/**
 * Compact preview: user-flow fields only.
 * Does not expose handoff bundle, preparation bundle, bridge input, or seed payload.
 */
export type PlanningOriginatedExecutionPreviewResponse = {
  readonly projectId: string;
  /** Same as root response `status` for nested payloads / partial renders. */
  readonly status: PlanningOriginatedExecutionStatus;
  readonly planningStatus: string | null;
  readonly requiresConfirmation: boolean;
  readonly confirmationNeededSummary: PlanningOriginatedConfirmationNeededSummary;
  readonly featureCount: number;
  readonly screenCount: number;
  readonly taskCount: number;
  readonly blockingReason: string | null;
  readonly orderedTaskIds: readonly string[];
  /** Structural label for UI chips (status string; not i18n). */
  readonly summaryLabel: string;
  /** Non-null only when execution has successfully started (mirrors root). */
  readonly runId: string | null;
};

export type PlanningOriginatedExecutionFailureResponse =
  | {
      readonly ok: false;
      readonly status: "BLOCKED";
      /** Stable diagnostic string from the facade (not a localization key). */
      readonly internalReasonCode: string;
      /** Structural outward summary (English phrase; not an i18n framework). */
      readonly reasonSummary: string;
      readonly planning: PlanningOriginatedExecutionPlanningResponseSlice;
    }
  | {
      readonly ok: false;
      readonly status: "NEEDS_CONFIRMATION";
      readonly internalReasonCode: string;
      readonly reasonSummary: string;
      readonly planning: PlanningOriginatedExecutionPlanningResponseSlice;
    }
  | {
      readonly ok: false;
      readonly status: "EXECUTION_START_FAILED";
      readonly internalReasonCode: string;
      readonly reasonSummary: string;
      readonly preview: PlanningOriginatedExecutionPreviewResponse;
    };

export type PlanningOriginatedExecutionStartedResponse = {
  readonly ok: true;
  readonly status: "EXECUTION_STARTED";
  readonly runId: string;
  readonly reasonSummary: string;
  readonly preview: PlanningOriginatedExecutionPreviewResponse;
};

export type PlanningOriginatedExecutionResponse =
  | PlanningOriginatedExecutionFailureResponse
  | PlanningOriginatedExecutionStartedResponse
  | {
      readonly ok: true;
      readonly status: "READY_FOR_EXECUTION";
      readonly reasonSummary: string;
      readonly preview: PlanningOriginatedExecutionPreviewResponse;
    };
