/**
 * Planning-layer Screen synthesis from IA menu nodes (no HTTP / no execution).
 */

import type { IaGenerationResult } from "../iaGeneration/iaGenerationContracts";

export type ScreenGenerationRule = "FROM_MENU_LEAF" | "FROM_MENU_GROUP" | "FROM_ROOT_CHILD";

export type ScreenRole = "ENTRY" | "LIST" | "DETAIL" | "CREATE" | "EDIT" | "GENERAL";

export type ScreenDraft = {
  id: string;
  projectId: string;
  name: string;
  menuId: string;
  routePath: string;
  order: number;
  /** Present when the source menu’s parent is not the synthetic root. */
  parentScreenId?: string;
  screenRole: ScreenRole;
};

export type ScreenTrace = {
  screenId: string;
  menuId: string;
  sourceFeatureIds?: string[];
};

export type ScreenGenerationResult = {
  projectId: string;
  screens: ScreenDraft[];
  traces: ScreenTrace[];
};

export type StandardScreenGenerationState = "GENERATED" | "EMPTY_IA" | "INVALID_MENU_INPUT";

export type StandardScreenGenerationOutput = {
  state: StandardScreenGenerationState;
  result: ScreenGenerationResult | null;
};

export type GenerateStandardScreensRequest = {
  iaResult: IaGenerationResult;
};
