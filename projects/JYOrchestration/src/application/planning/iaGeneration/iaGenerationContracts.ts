/**
 * Planning-layer IA (menu) synthesis from standardized features (no HTTP / no execution).
 */

import type { FeatureGenerationResult } from "../featureGeneration/featureGenerationContracts";

export type IaGenerationRule = "FLAT_FEATURE" | "GROUPED_POST_PARENT" | "GROUPED_POST_CHILD" | "ROOT";

export type IaMenuDraft = {
  id: string;
  projectId: string;
  name: string;
  /** `null` for the synthetic application root (matches {@link MvpMenuNode}). */
  parentId: string | null;
  order: number;
  sourceFeatureIds: string[];
};

export type IaNodeTrace = {
  menuId: string;
  featureIds: string[];
};

export type IaGenerationResult = {
  projectId: string;
  menuNodes: IaMenuDraft[];
  traces: IaNodeTrace[];
};

export type StandardIaGenerationState = "GENERATED" | "EMPTY_FEATURES" | "INVALID_FEATURE_INPUT";

export type StandardIaGenerationOutput = {
  state: StandardIaGenerationState;
  result: IaGenerationResult | null;
};

export type GenerateStandardIaRequest = {
  featureResult: FeatureGenerationResult;
};
