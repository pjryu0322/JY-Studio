/**
 * Requirement Input — build {@link MvpRequirement} rows from a single user idea string.
 *
 * Splitting is intentionally small and deterministic (no NLP / no LLM):
 * - Prefer split on Korean conjunction `하고` when both sides are long enough.
 * - Else split on commas when each segment is long enough.
 * - Else one requirement.
 *
 */

import type { MvpRequirement } from "../../../mvp/domain/mvpDomainTypes";
import { normalizeRequirementText } from "./mvpNormalizeRequirementText";

function splitRawChunks(normalized: string): string[] {
  const byHang = normalized
    .split(/\s*하고\s+/u)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (byHang.length >= 2 && byHang.every((p) => p.length >= 8)) {
    return byHang;
  }
  const byComma = normalized
    .split(/\s*,\s*/u)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (byComma.length >= 2 && byComma.every((p) => p.length >= 4)) {
    return byComma;
  }
  return [normalized];
}

function stripFillerAroundClause(chunk: string): string {
  let s = chunk.trim();
  s = s.replace(/^(사용자가|사용자는)\s+/u, "");
  s = s.replace(/\s+할\s+수\s+있는\s+/u, " ");
  s = s.replace(/\s+(웹\s*)?서비스를\s*만들고\s*싶다\s*$/u, "");
  s = s.replace(/\s*만들고\s*싶다\s*$/u, "");
  s = s.replace(/\s+/g, " ").trim();
  return s.length > 0 ? s : chunk.trim();
}

function polishDescriptions(rawChunks: readonly string[]): string[] {
  return rawChunks.map((raw) => {
    const base = stripFillerAroundClause(raw);
    return base.length > 0 ? base : raw.trim();
  });
}

/**
 * @param inputText Raw user idea (one sentence or short paragraph).
 * @param projectId MVP project id for generated requirement ids.
 * @returns New requirement rows (not yet persisted — caller may `mvpSeedProjectRequirements`).
 */
export function createRequirementsFromInput(inputText: string, projectId: string): MvpRequirement[] {
  const normalized = normalizeRequirementText(inputText);
  if (!normalized) {
    return [];
  }
  const rawChunks = splitRawChunks(normalized);
  const descriptions = polishDescriptions(rawChunks).filter((d) => d.length > 0);
  if (descriptions.length === 0) {
    return [];
  }
  return descriptions.map((description, i) => ({
    id: `req-${projectId}-in-${i}`,
    projectId,
    description,
    status: "CONFIRMED" as const,
  }));
}
