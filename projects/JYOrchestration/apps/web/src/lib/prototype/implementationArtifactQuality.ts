/**
 * Contract-driven artifact quality — public types and evaluators.
 * Rule execution lives in implementationArtifactContractQuality.ts.
 */
export type {
  ArtifactContractQualityResultV1,
  ArtifactContractQualityStatusV1,
  QualityIssueLevelV1,
  QualityIssueV1,
} from "@/lib/prototype/implementationArtifactContractQuality";

export {
  evaluateArtifactContractRule,
  evaluateCodeTaskArtifactContractQuality,
  evaluateArtifactContractRules,
  buildCustomSummaryFieldContract,
} from "@/lib/prototype/implementationArtifactContractQuality";

export type {
  ArtifactContractRuleV1,
  CodeTaskArtifactContractV1,
} from "@/lib/prototype/implementationArtifactContract";

export {
  buildSampleDataArtifactContract,
  meetingSampleDataArtifactContract,
  resolveCodeTaskArtifactContract,
} from "@/lib/prototype/implementationArtifactContract";

export type QualityIssueLevel = "fail" | "warning" | "integration_required";

export type QualityIssue = Readonly<{
  readonly level: QualityIssueLevel;
  readonly ruleId: string;
  readonly message: string;
  readonly filePath?: string;
  readonly exportName?: string;
  readonly fieldPath?: string;
}>;

export type ArtifactQualityResultStatus = "passed" | "failed" | "pending" | "integration_required";

export type ArtifactQualityResult = Readonly<{
  readonly status: ArtifactQualityResultStatus;
  readonly failIssues: readonly QualityIssue[];
  readonly warnings: readonly QualityIssue[];
  readonly integrationRequiredIssues: readonly QualityIssue[];
  readonly passedChecks: readonly string[];
}>;
