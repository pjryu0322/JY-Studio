/**
 * Build structured requirement drafts + gaps from a raw planning request.
 */

import type { RequirementDraft, RequirementDraftResult, RequirementInputRequest } from "./requirementInputContracts";
import { normalizeRequirementInput } from "./normalizeRequirementInput";
import { splitRequirementInput } from "./splitRequirementInput";
import { detectRequirementGaps } from "./detectRequirementGaps";

function confidenceForDraft(description: string, totalDrafts: number): "HIGH" | "MEDIUM" {
  if (totalDrafts === 1 && description.length >= 12) return "HIGH";
  if (description.length < 12) return "MEDIUM";
  return "MEDIUM";
}

export function buildRequirementDrafts(request: RequirementInputRequest): RequirementDraftResult {
  const { text: normalizedText } = normalizeRequirementInput(request.inputText);
  if (!normalizedText) {
    return { normalizedText: "", drafts: [], gaps: detectRequirementGaps("", []) };
  }

  const descriptions = [...splitRequirementInput(normalizedText)];
  const drafts: RequirementDraft[] = descriptions.map((description, i) => ({
    id: `draft-${request.projectId}-${i}`,
    projectId: request.projectId,
    description,
    source: "USER_INPUT",
    confidence: confidenceForDraft(description, descriptions.length),
  }));

  const gaps = detectRequirementGaps(normalizedText, drafts);
  return { normalizedText, drafts, gaps };
}
