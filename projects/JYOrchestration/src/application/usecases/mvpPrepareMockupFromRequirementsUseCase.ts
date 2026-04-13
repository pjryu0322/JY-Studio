/**
 * JYOrchestration — use-case: make the upstream workflow explicit (Requirement→Feature→IA→Screen→Task).
 *
 * Preparation-only. Does NOT call executionService.
 */

import type { Task } from "../../mvp/task/taskService";
import type { MvpFeature, MvpMenuNode, MvpRequirement, MvpScreen } from "../../mvp/domain/mvpDomainTypes";
import {
  generateFeaturesFromRequirements,
  generateIAFromFeatures,
  generateMockupTasksFromRequirements,
  generateScreensFromIA,
} from "../../mvp/domain/mvpDomainGenerationService";
import { mvpListProjectRequirements } from "../../mvp/domain/stores/mvpRequirementStore";
import { generateScreenFlow } from "../../mvp/screen/mvpScreenFlowService";
import type { ScreenFlowGraph } from "../../mvp/screen/mvpScreenFlowTypes";

export type MvpPreparedMockupFromRequirements = {
  projectId: string;
  requirements: MvpRequirement[];
  features: MvpFeature[];
  menu: MvpMenuNode[];
  screens: MvpScreen[];
  screenFlow: ScreenFlowGraph;
  tasks: Task[];
};

export function mvpPrepareMockupFromRequirementsUseCase(projectId: string): MvpPreparedMockupFromRequirements {
  const requirements = [...mvpListProjectRequirements(projectId)].map((r) => ({ ...r }));
  const features = generateFeaturesFromRequirements(requirements);
  const menu = generateIAFromFeatures(features);
  const screens = generateScreensFromIA(menu);
  const screenFlow = generateScreenFlow(screens);
  const tasks = generateMockupTasksFromRequirements(projectId);
  return {
    projectId,
    requirements: requirements.map((r) => ({ ...r })),
    features: features.map((f) => ({ ...f })),
    menu: menu.map((m) => ({ ...m })),
    screens: screens.map((s) => ({ ...s })),
    screenFlow,
    tasks: tasks.map((t) => ({ ...t })),
  };
}

