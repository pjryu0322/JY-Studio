/**
 * MVP — domain generation pipeline (canonical upstream entry: **Requirement[]**).
 *
 * Requirement[] → Feature → IA (menu) → Screen → Task → (downstream: Prompt → mockup execution).
 *
 * There is **no ProjectSpec** dependency in this module: callers supply requirements (from user
 * idea text, seeded rows, or a legacy ProjectSpec body converted to a single Requirement elsewhere).
 *
 * Pure, deterministic generators. No execution integration.
 */

import type { Task, TaskPurpose } from "../task/taskService";
import type { MvpFeature, MvpMenuNode, MvpRequirement, MvpScreen } from "./mvpDomainTypes";
import { validateDomainMapping } from "./mvpDomainValidationService";
import { mvpListProjectRequirements, mvpSeedProjectRequirements } from "./stores/mvpRequirementStore";
import { mvpSeedProjectMenuNodes } from "./stores/mvpMenuStore";
import { mvpSeedProjectScreens } from "./stores/mvpScreenStore";
import { generateScreenFlow, getOrderedScreensFromFlow, validateScreenFlow } from "../screen/mvpScreenFlowService";
import { orderTasksByScreenFlow } from "../screen/mvpScreenFlowTaskOrdering";
import { mvpSeedProjectScreenFlow } from "../screen/stores/mvpScreenFlowStore";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function generateFeaturesFromRequirements(requirements: readonly MvpRequirement[]): MvpFeature[] {
  return requirements.map((r, i) => ({
    id: `feat-${r.projectId}-${i}`,
    projectId: r.projectId,
    name: `Feature ${i + 1}`,
    requirementIds: [r.id],
    order: i,
  }));
}

export function generateIAFromFeatures(features: readonly MvpFeature[]): MvpMenuNode[] {
  if (features.length === 0) return [];
  const projectId = features[0]!.projectId;
  const rootId = `menu-root-${projectId}`;
  return [
    { id: rootId, projectId, name: "Root", parentId: null, order: 0 },
    ...features.map((f) => ({
      id: `menu-${f.id}`,
      projectId: f.projectId,
      name: f.name,
      parentId: rootId,
      order: f.order,
    })),
  ];
}

export function generateScreensFromIA(menuTree: readonly MvpMenuNode[]): MvpScreen[] {
  const rootIds = new Set(menuTree.filter((m) => m.parentId == null).map((m) => m.id));
  const nodes = menuTree.filter((m) => !rootIds.has(m.id)).sort((a, b) => a.order - b.order);
  return nodes.map((m, i) => ({
    id: `screen-${m.projectId}-${i}`,
    projectId: m.projectId,
    name: m.name,
    menuId: m.id,
    routePath: `/${slugify(m.name || `screen-${i + 1}`)}`,
    order: m.order,
  }));
}

export function generateTasksFromScreens(
  screens: readonly MvpScreen[],
  purpose: TaskPurpose = "MOCKUP"
): Task[] {
  return [...screens]
    .sort((a, b) => a.order - b.order)
    .map((s, idx) => ({
      id: `task-${s.projectId}-${idx}`,
      title: `${purpose}: ${s.name}`,
      description: `Generated from domain screen: ${s.name}`,
      type: "FUNCTIONAL",
      status: "CONFIRMED",
      finalOrder: s.order,
      projectId: s.projectId,
      screenId: s.id,
      taskPurpose: purpose,
    }));
}

/**
 * Requirement-based mockup generation: builds MOCKUP tasks from an explicit requirement list.
 * Seeds the in-memory requirement store with the given list so lookups stay aligned with the graph.
 */
export function generateMockupTasksFromRequirementList(projectId: string, requirements: readonly MvpRequirement[]): Task[] {
  const reqList = requirements.map((r) => ({ ...r, projectId }));
  mvpSeedProjectRequirements(projectId, reqList);

  const features = generateFeaturesFromRequirements(reqList);
  const menu = generateIAFromFeatures(features);
  const screens = generateScreensFromIA(menu);
  const graph = generateScreenFlow(screens);
  const flowOk = validateScreenFlow(graph);
  if (!flowOk.ok) {
    throw new Error(`MVP_SCREEN_FLOW_INVALID: ${flowOk.errors.join(" | ")}`);
  }
  const orderedScreens = getOrderedScreensFromFlow(graph);
  const tasks = orderTasksByScreenFlow(generateTasksFromScreens(orderedScreens, "MOCKUP"), graph.screens, graph.edges);

  // Seed stores for prompt context lookup (still isolated; no execution integration).
  mvpSeedProjectMenuNodes(projectId, menu);
  mvpSeedProjectScreens(projectId, screens);
  mvpSeedProjectScreenFlow(projectId, graph);

  const ok = validateDomainMapping({
    requirements: reqList,
    features,
    menuNodes: menu,
    screens,
    tasks,
    allowLegacyTasks: false,
  });
  if (!ok.ok) {
    throw new Error(`MVP_DOMAIN_MAPPING_INVALID: ${ok.errors.join(" | ")}`);
  }
  return tasks;
}

/**
 * Same as {@link generateMockupTasksFromRequirementList} using requirements currently in the MVP store.
 */
export function generateMockupTasksFromRequirements(projectId: string): Task[] {
  return generateMockupTasksFromRequirementList(projectId, mvpListProjectRequirements(projectId));
}

