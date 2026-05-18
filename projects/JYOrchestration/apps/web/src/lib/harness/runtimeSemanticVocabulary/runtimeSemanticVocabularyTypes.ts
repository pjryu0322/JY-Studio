/**
 * H19 — Runtime **semantic vocabulary** & meaning normalization metadata(read-only).
 */

export type RuntimeSemanticMeaningLevel = "info" | "watch" | "critical";

export type RuntimeSemanticVocabularySourceLayer =
  | "graph"
  | "narrative"
  | "governance"
  | "warning"
  | "compression"
  | "overlay";

export type RuntimeSemanticVocabularyEntry = Readonly<{
  rawLabel: string;
  canonicalKey: string;
  canonicalLabelKo: string;
  meaningLevel: RuntimeSemanticMeaningLevel;
  sourceLayer: RuntimeSemanticVocabularySourceLayer;
}>;

export type RuntimeSemanticVocabularyGroup = Readonly<{
  canonicalKey: string;
  canonicalLabelKo: string;
  entries: readonly RuntimeSemanticVocabularyEntry[];
  collapsedAliasCount: number;
}>;

export type RuntimeSemanticNormalizedLabel = Readonly<{
  canonicalKey: string;
  labelKo: string;
  meaningLevel: RuntimeSemanticMeaningLevel;
}>;

export type RuntimeSemanticVocabularySummary = Readonly<{
  mode: "runtime_semantic_vocabulary_summary";
  actualRuntimeOrchestrationEnabled: false;
  groups: readonly RuntimeSemanticVocabularyGroup[];
  normalizedLabels: readonly RuntimeSemanticNormalizedLabel[];
  collapsedDuplicateCount: number;
  recommendations: readonly string[];
}>;

export type RuntimeSemanticPriorityKind =
  | "governance_criticality"
  | "semantic_explosion"
  | "hidden_trace"
  | "dependency_saturation"
  | "propagation_escalation"
  | "stale_runtime"
  | "stable_planning";

export type RuntimeSemanticPriorityEntry = Readonly<{
  kind: RuntimeSemanticPriorityKind;
  labelKo: string;
  rank: number;
  meaningLevel: RuntimeSemanticMeaningLevel;
}>;

export type RuntimeSemanticPriorityVocabulary = Readonly<{
  mode: "runtime_semantic_priority_vocabulary";
  actualRuntimeOrchestrationEnabled: false;
  priorities: readonly RuntimeSemanticPriorityEntry[];
  topPriorityLabelKo: string;
  recommendations: readonly string[];
}>;

export type RuntimeSemanticVocabularyPlanningReports = Readonly<{
  semanticVocabularySummary: RuntimeSemanticVocabularySummary;
  semanticNormalizedLabels: readonly RuntimeSemanticNormalizedLabel[];
  semanticPriorityVocabulary: RuntimeSemanticPriorityVocabulary;
}>;
