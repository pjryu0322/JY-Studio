/**
 * Planning-layer Feature synthesis from refined requirements (no HTTP / no execution).
 */

export type FeatureGroupingRule = "DOMAIN_VIDEO_MEETING" | "DOMAIN_POST_BROWSE" | "DOMAIN_POST_GENERAL" | "DOMAIN_AUTH_LOGIN" | "DOMAIN_SETTINGS" | "LITERAL";

export type FeatureDraft = {
  id: string;
  projectId: string;
  name: string;
  requirementIds: string[];
  order: number;
  source: "REQUIREMENT_REFINEMENT";
};

export type FeatureSourceTrace = {
  featureId: string;
  requirementIds: string[];
};

export type FeatureGenerationResult = {
  projectId: string;
  features: FeatureDraft[];
  traces: FeatureSourceTrace[];
};

/** Internal outcome for {@link generateStandardFeatures} (no HTTP mapping). */
export type StandardFeaturesGenerationState = "GENERATED" | "EMPTY_INPUT" | "INVALID_READY_BUNDLE";

export type StandardFeaturesGenerationOutput = {
  state: StandardFeaturesGenerationState;
  result: FeatureGenerationResult | null;
};

export type RequirementFeatureGroup = {
  groupingRule: FeatureGroupingRule;
  clusterKey: string;
  requirementIds: string[];
  descriptions: string[];
};
