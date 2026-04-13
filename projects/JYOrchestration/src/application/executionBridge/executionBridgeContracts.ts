/**
 * Planning-side execution **bridge** (ExecutionPreparationBundle → guarded `mvpStartExecutionUseCase`).
 * Does not modify `executionService` internals.
 */

import type { ExecutionPreparationValidationResult } from "../executionPreparation/executionPreparationContracts";

export type ExecutionBridgeTaskInput = {
  readonly taskId: string;
  readonly projectId: string;
  readonly name: string;
  readonly screenId: string;
  readonly order: number;
  readonly taskPurpose: "MOCKUP";
};

export type ExecutionBridgeInput = {
  readonly projectId: string;
  readonly source: "EXECUTION_PREPARATION";
  readonly tasks: readonly ExecutionBridgeTaskInput[];
  readonly metadata?: {
    readonly taskCount: number;
    readonly screenCount: number;
  };
};

export type ExecutionBridgeValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reasons: readonly string[] };

export type ExecutionBridgePrepareResult =
  | { readonly ok: true; readonly input: ExecutionBridgeInput }
  | { readonly ok: false; readonly reason: string };

export type ExecutionBridgeStartResult =
  | { readonly ok: true; readonly runId: string; readonly sourceTaskCount: number }
  | { readonly ok: false; readonly reason: string };

export type DryRunExecutionBridgeResult = {
  readonly ok: boolean;
  readonly reason?: string;
  readonly preparationValidation: ExecutionPreparationValidationResult;
  readonly bridgeInput?: ExecutionBridgeInput;
  readonly bridgeValidation?: ExecutionBridgeValidationResult;
};
