/**
 * H14 — Runtime planning **coherence & synchronization** metadata(read-only).
 */

export type RuntimePlanningCoherenceLevel = "aligned" | "partial" | "misaligned";

export type RuntimePlanningSynchronizationState = "synchronized" | "lagging" | "desynchronized";

export type RuntimePlanningDivergenceSeverity = "low" | "medium" | "high";

export type RuntimePlanningCoherenceSummary = Readonly<{
  mode: "runtime_planning_coherence_summary";
  actualRuntimeOrchestrationEnabled: false;
  coherenceLevel: RuntimePlanningCoherenceLevel;
  alignmentScore: number;
  misalignedAreas: readonly string[];
  alignmentFactors: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePlanningSynchronizationSummary = Readonly<{
  mode: "runtime_planning_synchronization_summary";
  actualRuntimeOrchestrationEnabled: false;
  synchronizationState: RuntimePlanningSynchronizationState;
  staleConsistencyIssues: readonly string[];
  syncTargets: readonly string[];
  laggingLayers: readonly string[];
  recommendations: readonly string[];
}>;

export type RuntimePlanningDivergenceReport = Readonly<{
  mode: "runtime_planning_divergence_report";
  actualRuntimeOrchestrationEnabled: false;
  divergenceSeverity: RuntimePlanningDivergenceSeverity;
  divergenceAreas: readonly string[];
  divergenceReasons: readonly string[];
  recommendations: readonly string[];
}>;
