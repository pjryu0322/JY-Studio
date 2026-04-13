/**
 * Planning → execution **handoff** contracts (planning-side only; no execution wiring).
 */

import type { PipelineStageOutputCounts } from "../pipeline/pipelineContext";
import type { FeatureGenerationResult } from "../planning/featureGeneration/featureGenerationContracts";
import type { ScreenGenerationResult } from "../planning/screenGeneration/screenGenerationContracts";
import type { TaskGenerationResult } from "../planning/taskGeneration/taskGenerationContracts";

/** Stable, trimmed view of refined requirements for downstream execution prep. */
export type RefinedRequirementHandoffSummary = {
  readonly id: string;
  readonly projectId: string;
  readonly description: string;
  readonly status: "DRAFT" | "REFINED";
  readonly source: "USER_INPUT" | "AUTO_RESOLVED";
};

/** IA / menu snapshot (deterministic ordering by menu id). */
export type IaMenuHandoffSummary = {
  readonly projectId: string;
  readonly menuNodeCount: number;
  readonly rootMenuNodeCount: number;
  readonly menuNodesOrderedById: readonly {
    readonly id: string;
    readonly projectId: string;
    readonly name: string;
    readonly parentId: string | null;
    readonly order: number;
    readonly sourceFeatureIdsOrdered: readonly string[];
  }[];
};

/** Explicit confirmation that planning satisfied execution-prep gates (all literals true when bundle exists). */
export type PlanningReadinessConfirmation = {
  readonly pipelineStatusReady: true;
  readonly featureEntryReady: true;
  readonly readinessIsReady: true;
  readonly readinessBlockingIssueCount: 0;
  readonly readinessConfirmRequiredCount: 0;
  readonly refinedRequirementCount: number;
};

export type PlanningHandoffTraceMetadata = {
  readonly executedSteps: readonly string[];
  readonly stageOutputCounts: PipelineStageOutputCounts;
  /** Bounded sample of pipeline trace lines (deterministic head slice). */
  readonly traceLogSample: readonly string[];
};

/**
 * Represents planning completed enough to **prepare** execution (not execution itself).
 */
export type PlanningExecutionHandoffBundle = {
  readonly projectId: string;
  readonly pipelineStatus: "READY";
  readonly planningReadiness: PlanningReadinessConfirmation;
  readonly refinedRequirementsSummary: readonly RefinedRequirementHandoffSummary[];
  readonly features: FeatureGenerationResult;
  readonly iaMenuSummary: IaMenuHandoffSummary;
  readonly screens: ScreenGenerationResult;
  readonly tasks: TaskGenerationResult;
  readonly traceMetadata: PlanningHandoffTraceMetadata;
};

export type PlanningHandoffValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reasons: readonly string[] };

export type BuildPlanningExecutionHandoffResult =
  | { readonly ok: true; readonly bundle: PlanningExecutionHandoffBundle }
  | { readonly ok: false; readonly reason: string };

export type PreparePlanningExecutionHandoffResult =
  | { readonly ok: true; readonly bundle: PlanningExecutionHandoffBundle }
  | { readonly ok: false; readonly reason: string };
