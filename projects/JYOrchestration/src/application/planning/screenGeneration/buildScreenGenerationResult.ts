/**
 * Wraps screen synthesis with internal empty / invalid semantics (no HTTP).
 */

import type { IaGenerationResult } from "../iaGeneration/iaGenerationContracts";
import type { ScreenGenerationResult, StandardScreenGenerationOutput } from "./screenGenerationContracts";
import { generateScreensFromIa, type ScreenMenuInput } from "./generateScreensFromIa";

function validateMenus(menus: readonly ScreenMenuInput[]): string | null {
  const byId = new Map(menus.map((m) => [m.id, m]));
  const pids = new Set(menus.map((m) => m.projectId));
  if (pids.size > 1) return "MULTI_PROJECT";
  for (const m of menus) {
    if (m.parentId != null && !byId.has(m.parentId)) return "ORPHAN_PARENT";
  }
  return null;
}

export function buildScreenGenerationResult(iaResult: IaGenerationResult): StandardScreenGenerationOutput {
  const { projectId, menuNodes } = iaResult;
  const menus = menuNodes as ScreenMenuInput[];
  if (menus.length === 0) {
    return { state: "EMPTY_IA", result: { projectId, screens: [], traces: [] } };
  }
  const rootMenuIds = new Set(menus.filter((m) => m.parentId == null).map((m) => m.id));
  const contentMenus = menus.filter((m) => !rootMenuIds.has(m.id));
  if (contentMenus.length === 0) {
    return { state: "EMPTY_IA", result: { projectId, screens: [], traces: [] } };
  }
  const bad = validateMenus(menus);
  if (bad != null) {
    return { state: "INVALID_MENU_INPUT", result: null };
  }
  const result: ScreenGenerationResult = generateScreensFromIa(menus);
  return { state: "GENERATED", result };
}
