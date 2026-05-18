/**
 * Normalize raw user idea text for the Requirement Input layer (deterministic, no LLM).
 */

import type { RequirementInputNormalized } from "./requirementInputContracts";
import { normalizeRequirementText } from "../../usecases/requirement/mvpNormalizeRequirementText";

/**
 * Trims, flattens newlines to spaces, collapses repeated whitespace, then applies shared
 * filler stripping (see `normalizeRequirementText`).
 */
export function normalizeRequirementInput(inputText: string): RequirementInputNormalized {
  const flattened = String(inputText ?? "")
    .replace(/\r\n|\r|\n/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const text = normalizeRequirementText(flattened);
  return { text };
}
