export type MessageExplainabilityMode = "read_only_explainability";

export type MessageExplainabilityRiskLevel = "none" | "low" | "medium" | "high";

export type MessageExplainabilitySectionType =
  | "role"
  | "context"
  | "knowledge"
  | "memory"
  | "execution"
  | "review_security"
  | "issue_planning"
  | "budget"
  | "warnings";

export type MessageExplainabilitySection = Readonly<{
  type: MessageExplainabilitySectionType;
  title: string;
  summary: string;
  riskLevel: MessageExplainabilityRiskLevel;
}>;

export type MessageExplainabilityViewModel = Readonly<{
  mode: MessageExplainabilityMode;
  hasData: boolean;
  headline: string;
  summaryLines: readonly string[];
  sections: readonly MessageExplainabilitySection[];
  warningCount: number;
  riskLevel: MessageExplainabilityRiskLevel;
  disclaimer: string;
}>;
