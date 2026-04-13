/**
 * MVP — domain mapping validation (no orphans).
 */

import type { Task } from "../task/taskService";
import type { MvpFeature, MvpMenuNode, MvpRequirement, MvpScreen } from "./mvpDomainTypes";

export type MvpDomainMappingInput = {
  requirements: readonly MvpRequirement[];
  features: readonly MvpFeature[];
  menuNodes: readonly MvpMenuNode[];
  screens: readonly MvpScreen[];
  tasks: readonly Task[];
  /** Legacy tasks without `screenId` are allowed by default. */
  allowLegacyTasks?: boolean;
};

export type MvpDomainMappingValidationResult =
  | { ok: true }
  | {
      ok: false;
      errors: string[];
    };

export function validateDomainMapping(input: MvpDomainMappingInput): MvpDomainMappingValidationResult {
  const errors: string[] = [];

  const reqIds = new Set(input.requirements.map((r) => r.id));
  for (const f of input.features) {
    for (const rid of f.requirementIds) {
      if (!reqIds.has(rid)) {
        errors.push(`FEATURE_ORPHAN_REQUIREMENT: feature ${f.id} references requirement ${rid}`);
      }
    }
  }

  const menuIds = new Set(input.menuNodes.map((m) => m.id));
  for (const m of input.menuNodes) {
    if (m.parentId != null && !menuIds.has(m.parentId)) {
      errors.push(`IA_ORPHAN_PARENT: menu ${m.id} parentId ${m.parentId} not found`);
    }
  }

  const screenIds = new Set(input.screens.map((s) => s.id));
  for (const s of input.screens) {
    if (!menuIds.has(s.menuId)) {
      errors.push(`SCREEN_ORPHAN_MENU: screen ${s.id} menuId ${s.menuId} not found`);
    }
  }

  const allowLegacy = input.allowLegacyTasks !== false;
  for (const t of input.tasks) {
    const screenId = (t as { screenId?: string }).screenId;
    if (!screenId) {
      if (!allowLegacy) {
        errors.push(`TASK_MISSING_SCREEN: task ${t.id} missing screenId`);
      }
      continue;
    }
    if (!screenIds.has(screenId)) {
      errors.push(`TASK_ORPHAN_SCREEN: task ${t.id} screenId ${screenId} not found`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

