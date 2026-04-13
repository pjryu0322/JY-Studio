/**
 * Execution-facing **preparation** model (planning → future execution bridge; no `executionService`).
 */

/** Minimal task row derived from planning handoff (name preserved for prompts). */
export type ExecutionPreparationTask = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly screenId: string;
  readonly order: number;
  readonly taskPurpose: "MOCKUP";
};

/** Lightweight screen ref for execution prep (no planning traces / menu wiring). */
export type ExecutionPreparationScreenRef = {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly routePath: string;
  /** Serialized role for execution-facing consumers. */
  readonly screenRole: string;
};

export type ExecutionPreparationContext = {
  readonly projectId: string;
  readonly taskCount: number;
  readonly screenCount: number;
  readonly featureCount: number;
};

export type ExecutionPreparationBundle = {
  readonly projectId: string;
  readonly context: ExecutionPreparationContext;
  readonly screens: readonly ExecutionPreparationScreenRef[];
  readonly tasks: readonly ExecutionPreparationTask[];
  readonly source: "PLANNING_HANDOFF";
};

export type ExecutionPreparationValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reasons: readonly string[] };

export type BuildExecutionPreparationBundleResult =
  | { readonly ok: true; readonly bundle: ExecutionPreparationBundle }
  | { readonly ok: false; readonly reason: string };

/** Application outcome for `mvpPrepareExecutionInputFromPlanningUseCase`. */
export type PrepareExecutionInputResult =
  | { readonly ok: true; readonly bundle: ExecutionPreparationBundle }
  | { readonly ok: false; readonly reason: string };
