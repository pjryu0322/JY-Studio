/**
 * **UI-facing view-models** for planning-originated execution.
 *
 * **Boundary:** screens should depend on these types and on
 * {@link import("./planningOriginatedExecutionViewModelBuilder").buildPlanningOriginatedExecutionViewModel},
 * not on raw {@link import("../contracts/planningOriginatedExecutionResponse").PlanningOriginatedExecutionResponse}
 * field shapes beyond what the builder exposes here, and never on internal bundles or bridge payloads.
 *
 * **Normalized response contract** remains the application/API boundary; this layer is the **UI presentation boundary**
 * (structural labels, tones, action intents — not components, not i18n).
 *
 * **Screen composition** (which panels/tabs bind to which fields) lives in
 * {@link import("./planningOriginatedExecutionScreenUx").PlanningExecutionScreenViewModel} and
 * {@link import("./planningOriginatedExecutionScreenUxBuilder").buildPlanningExecutionScreenViewModel}.
 */

import type { PlanningOriginatedExecutionStatus } from "../contracts/planningOriginatedExecutionResponse";
import type { PlanningOriginatedConfirmationNeededSummary } from "../contracts/planningOriginatedExecutionResponse";

/** Visual tone for status chrome (banners, badges) — structural only. */
export type PlanningExecutionTone = "danger" | "warning" | "neutral" | "success";

/** State-specific UX copy (no i18n system; deterministic strings). */
export type PlanningExecutionStatusCopy = Readonly<{
  headline: string;
  explanation: string;
  nextStepGuidance: string;
}>;

/** Structural action intents for buttons/links (not React components). */
export type PlanningExecutionStructuralAction =
  | "EDIT_INPUT"
  | "REVIEW_CONFIRMATION"
  | "START_EXECUTION"
  | "VIEW_RUN_STATUS"
  | "REFRESH_STATUS"
  | "RETRY_EXECUTION"
  | "INSPECT_FAILURE";

/** Status strip / card: stable strings for future UI. */
export type PlanningExecutionStatusCardViewModel = Readonly<{
  status: PlanningOriginatedExecutionStatus;
  tone: PlanningExecutionTone;
  badgeLabel: string;
  headline: string;
  explanation: string;
  nextStepGuidance: string;
}>;

/** Counts + task order when execution preparation preview exists. */
export type PlanningExecutionCountsViewModel = Readonly<{
  featureCount: number;
  screenCount: number;
  taskCount: number;
  orderedTaskIds: readonly string[];
}>;

/** Primary / secondary CTA hints and full menu of allowed intents. */
export type PlanningExecutionActionViewModel = Readonly<{
  primaryAction: PlanningExecutionStructuralAction;
  secondaryAction: PlanningExecutionStructuralAction | null;
  availableActions: readonly PlanningExecutionStructuralAction[];
}>;

/** Summaries for copy blocks / tooltips — no raw engine arrays. */
export type PlanningExecutionMessageViewModel = Readonly<{
  reasonSummary: string;
  /** When present, mirrors response `internalReasonCode` for support-style UI (optional strip in product). */
  internalReasonCode: string | null;
  blockingReasonSummary: string | null;
}>;

/** Minimal planning-phase hints when there is no execution preview. */
export type PlanningExecutionPlanningHintsViewModel = Readonly<{
  planningStatus: string | null;
  pipelineErrorCount: number;
  executedStepCount: number;
  stopHint: string | null;
}> | null;

/** Root view-model for a planning-originated execution screen region. */
export type PlanningOriginatedExecutionViewModel = Readonly<{
  projectId: string;
  responseStatus: PlanningOriginatedExecutionStatus;
  statusCard: PlanningExecutionStatusCardViewModel;
  /** Non-null when preview exists on the response; otherwise null (planning-only terminals). */
  counts: PlanningExecutionCountsViewModel | null;
  confirmationNeededSummary: PlanningOriginatedConfirmationNeededSummary;
  /** Qualitative confirmation summary when confirmation is required (no refinement bundle). */
  confirmationNeededQualitativeSummary: string | null;
  runId: string | null;
  canStartExecution: boolean;
  canRetry: boolean;
  canInspect: boolean;
  actions: PlanningExecutionActionViewModel;
  message: PlanningExecutionMessageViewModel;
  planningHints: PlanningExecutionPlanningHintsViewModel;
}>;
