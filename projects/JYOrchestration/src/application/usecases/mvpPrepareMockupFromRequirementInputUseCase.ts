/**
 * JYOrchestration — use-case: **Requirement Input** (user idea) → full upstream bundle.
 *
 * Canonical flow: Requirement Input → Requirement[] → Feature → IA → Screen → Task.
 * Does not call `executionService`.
 */

import type { MvpPreparedMockupFromRequirements } from "./mvpPrepareMockupFromRequirementsUseCase";
import { mvpPrepareMockupFromRequirementsUseCase } from "./mvpPrepareMockupFromRequirementsUseCase";
import { mvpSeedProjectRequirements } from "../../mvp/domain/stores/mvpRequirementStore";
import { createRequirementsFromInput } from "./requirement";

/**
 * @param inputText Raw user idea string (trimmed / split by {@link createRequirementsFromInput}).
 */
export function mvpPrepareMockupFromRequirementInputUseCase(
  projectId: string,
  inputText: string
): MvpPreparedMockupFromRequirements {
  const requirements = createRequirementsFromInput(inputText, projectId);
  mvpSeedProjectRequirements(projectId, requirements);
  return mvpPrepareMockupFromRequirementsUseCase(projectId);
}
