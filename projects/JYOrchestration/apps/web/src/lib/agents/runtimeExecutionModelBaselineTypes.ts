/**
 * Stage 6-A runtime execution model baseline (read-only; no actual execution).
 */

import type {
  Stage5IntegratedKnowledgeFoundationClosureDecision,
  Stage5IntegratedKnowledgeFoundationClosureInput,
  Stage6EntryCandidate,
  Stage6EntryMode,
} from "@/lib/agents/stage5IntegratedKnowledgeFoundationClosureTypes";

export type RuntimeExecutionModelBaselineDecision =
  | "ready_for_execution_model_candidate"
  | "defer"
  | "blocked";

export type RuntimeExecutionModelStage = "stage_6_a_runtime_execution_model_baseline";
export type RuntimeExecutionModelMode = "read_only_runtime_execution_model_baseline";

export type RuntimeExecutionUnitKind =
  | "agent_task_execution"
  | "cursor_code_assistant_execution"
  | "github_operation"
  | "review_gate"
  | "security_gate"
  | "operator_approval_gate";

export type RuntimeExecutionBoundary =
  | "design_only"
  | "approval_required"
  | "no_direct_execution"
  | "no_db_write"
  | "no_external_side_effect";

export interface RuntimeExecutionModelBaselineFinding {
  readonly severity: "info" | "warning" | "blocking";
  readonly code: string;
  readonly message: string;
}

export interface RuntimeExecutionModelBaselineChecklistItem {
  readonly item: string;
  readonly satisfied: boolean;
  readonly reason: string;
}

export interface RuntimeExecutionModelBaselineInput {
  readonly stage5Closure?: Stage5IntegratedKnowledgeFoundationClosureInput;
  readonly stage6ModelReviewConfirmed?: boolean;
  readonly stage6NoActualExecutionConfirmed?: boolean;
  readonly stage6NoConnectorRoutingChangeConfirmed?: boolean;
  readonly stage6NoDbMigrationConfirmed?: boolean;
  readonly stage6NoFeatureFlagWireConfirmed?: boolean;
  readonly requestedExecutionUnitKinds?: readonly RuntimeExecutionUnitKind[];
}

export interface RuntimeExecutionModelBaselineReport {
  readonly mode: RuntimeExecutionModelMode;
  readonly stage: RuntimeExecutionModelStage;
  readonly decision: RuntimeExecutionModelBaselineDecision;

  readonly sourceStage5Decision: Stage5IntegratedKnowledgeFoundationClosureDecision;
  readonly sourceStage6EntryCandidate: Stage6EntryCandidate;
  readonly sourceStage6EntryMode: Stage6EntryMode;
  readonly sourceStage6ActualRuntimeExecutionAllowed: false;
  readonly sourceStage6RequiresSeparateApproval: true;

  readonly modelBaselineVersion: "runtime_execution_model_baseline_v1";
  readonly modelBaselineTitle: string;
  readonly modelBaselineSummary: string;
  readonly modelBaselineFingerprint: string;

  readonly executionModelDesignOnly: true;
  readonly actualRuntimeExecutionAllowedInThisStep: false;
  readonly actualConnectorRoutingChangeAllowedInThisStep: false;
  readonly actualCursorExecutionAllowedInThisStep: false;
  readonly actualGithubOperationAllowedInThisStep: false;
  readonly actualDbWriteAllowedInThisStep: false;
  readonly actualFeatureFlagWireAllowedInThisStep: false;

  readonly executionUnitKinds: readonly RuntimeExecutionUnitKind[];
  readonly unknownExecutionUnitKinds: readonly string[];
  readonly executionUnitKindInputNormalized: boolean;
  readonly executionUnitKindDuplicateRemovedCount: number;
  readonly executionBoundaries: readonly RuntimeExecutionBoundary[];

  readonly requiredConfirmations: readonly string[];
  readonly confirmationChecklist: readonly RuntimeExecutionModelBaselineChecklistItem[];
  readonly boundaryChecklist: readonly RuntimeExecutionModelBaselineChecklistItem[];
  readonly findings: readonly RuntimeExecutionModelBaselineFinding[];

  readonly recommendedNextPhases: readonly string[];
  readonly separatedWorkItems: readonly string[];
}

export type RuntimeExecutionModelBaselineDecisionInput = {
  readonly sourceStage5Decision: Stage5IntegratedKnowledgeFoundationClosureDecision;
  readonly sourceStage6EntryMode: Stage6EntryMode;
  readonly sourceStage6ActualRuntimeExecutionAllowed: boolean;
  readonly sourceStage6RequiresSeparateApproval: boolean;
  readonly confirmationsSatisfied: boolean;
  readonly hasUnknownExecutionUnitKind: boolean;
};
