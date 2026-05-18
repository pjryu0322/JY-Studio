/**
 * H17.5 — Runtime **semantic quality gate** metadata(read-only).
 */

import type { RuntimeSemanticGroupKind } from "./runtimeSemanticTypes";

export type RuntimeSemanticCompressionQuality = "safe" | "watch" | "over_compressed" | "under_compressed";

export type RuntimeSemanticAuditSeverity = "info" | "warning";

export type RuntimeSemanticAuditFinding = Readonly<{
  code: string;
  severity: RuntimeSemanticAuditSeverity;
  messageKo: string;
}>;

export type RuntimeSemanticCompressionQualityReport = Readonly<{
  mode: "runtime_semantic_compression_quality";
  actualRuntimeOrchestrationEnabled: false;
  quality: RuntimeSemanticCompressionQuality;
  preservedCriticalSignalCount: number;
  hiddenCriticalSignalCount: number;
  visibleTraceCount: number;
  hiddenTraceCount: number;
  findings: readonly RuntimeSemanticAuditFinding[];
  recommendations: readonly string[];
}>;

export type RuntimeHiddenSemanticTraceAudit = Readonly<{
  mode: "runtime_hidden_semantic_trace_audit";
  actualRuntimeOrchestrationEnabled: false;
  hiddenTraceCount: number;
  hiddenCriticalTransitionCount: number;
  hiddenDependencyWarningCount: number;
  hiddenPropagationWarningCount: number;
  hiddenGovernanceWarningCount: number;
  hiddenStaleWarningCount: number;
  findings: readonly RuntimeSemanticAuditFinding[];
  recommendations: readonly string[];
}>;

export type RuntimeSemanticGroupBalanceLevel = "balanced" | "watch" | "imbalanced";

export type RuntimeSemanticGroupBalanceSummary = Readonly<{
  mode: "runtime_semantic_group_balance_summary";
  actualRuntimeOrchestrationEnabled: false;
  balanceLevel: RuntimeSemanticGroupBalanceLevel;
  dominantGroupKind: RuntimeSemanticGroupKind | "none";
  missingCriticalGroups: readonly RuntimeSemanticGroupKind[];
  otherGroupSharePercent: number;
  findings: readonly RuntimeSemanticAuditFinding[];
  recommendations: readonly string[];
}>;
