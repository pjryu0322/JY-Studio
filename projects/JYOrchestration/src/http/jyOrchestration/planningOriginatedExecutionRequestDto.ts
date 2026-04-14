/**
 * **HTTP request contracts** for planning-originated execution (`POST .../planning-execution`).
 *
 * This layer validates inbound JSON only. **Business outcomes** are expressed solely via
 * {@link import("../../application/contracts/planningOriginatedExecutionResponse").PlanningOriginatedExecutionResponse}
 * returned by the route after {@link import("../../application/contracts/planningOriginatedExecutionResponseBuilder").presentPlanningOriginatedExecutionResult}.
 *
 * Route handlers must not treat request DTOs as planning/engine state — they are transport shapes only.
 */

import type { PlanningOriginatedExecutionMode } from "../../application/planningOriginatedExecution/planningOriginatedExecutionContracts";
import type { PlanningOriginatedExecutionInput } from "../../application/planningOriginatedExecution/planningOriginatedExecutionContracts";
import type { PrepareRequirementRefinementDecisionResult } from "../../application/planning/requirementInput/prepareRequirementRefinementDecision";

/** Validated POST body for `/api/jy-orchestration/planning-execution`. */
export type PlanningOriginatedExecutionRequestDto =
  | Readonly<{
      projectId: string;
      mode: PlanningOriginatedExecutionMode;
      planningInput: Readonly<{ kind: "inputText"; inputText: string }>;
    }>
  | Readonly<{
      projectId: string;
      mode: PlanningOriginatedExecutionMode;
      planningInput: Readonly<{ kind: "refinement"; refinement: PrepareRequirementRefinementDecisionResult }>;
    }>;

export type PlanningExecutionRequestParseResult =
  | { readonly ok: true; readonly dto: PlanningOriginatedExecutionRequestDto }
  | { readonly ok: false; readonly issues: readonly string[] };

/** Serializable 400 body (not a planning-originated execution response branch). */
export type PlanningExecutionBadRequestBody = Readonly<{
  error: "BAD_REQUEST";
  issues: readonly string[];
}>;

export function badRequestBody(issues: readonly string[]): PlanningExecutionBadRequestBody {
  return { error: "BAD_REQUEST", issues: [...issues] };
}

/** Accepts raw JSON body; performs structural parse only (no engine calls). */
export function parsePlanningExecutionRequest(body: unknown): PlanningExecutionRequestParseResult {
  const issues: string[] = [];

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, issues: ["body must be a JSON object"] };
  }

  const o = body as Record<string, unknown>;
  const projectId = typeof o.projectId === "string" ? o.projectId.trim() : "";
  if (!projectId) {
    issues.push("projectId is required");
  }

  const modeRaw = o.mode;
  let mode: PlanningOriginatedExecutionMode | undefined;
  if (modeRaw === "PREPARE_ONLY" || modeRaw === "PREPARE_AND_START") {
    mode = modeRaw;
  } else {
    issues.push('mode must be "PREPARE_ONLY" or "PREPARE_AND_START"');
  }

  const hasText = "inputText" in o && o.inputText !== undefined && o.inputText !== null;
  const hasRef = "refinement" in o && o.refinement !== undefined && o.refinement !== null;

  if (hasText && hasRef) {
    issues.push("provide only one of inputText or refinement");
  }
  if (!hasText && !hasRef) {
    issues.push("at least one planning input source is required: inputText or refinement");
  }

  let planningInput:
    | Readonly<{ kind: "inputText"; inputText: string }>
    | Readonly<{ kind: "refinement"; refinement: PrepareRequirementRefinementDecisionResult }>
    | null = null;
  if (hasText && !hasRef) {
    const t = typeof o.inputText === "string" ? o.inputText.trim() : "";
    if (!t) {
      issues.push("inputText must be a non-empty string when provided");
    } else {
      planningInput = { kind: "inputText", inputText: t };
    }
  }

  if (hasRef && !hasText) {
    const ref = o.refinement;
    if (!isLoosePrepareRequirementRefinementDecisionResult(ref)) {
      issues.push("refinement must match PrepareRequirementRefinementDecisionResult shape");
    } else {
      planningInput = { kind: "refinement", refinement: ref };
    }
  }

  if (issues.length > 0 || !planningInput || !projectId || !mode) {
    return { ok: false, issues: issues.length > 0 ? issues : ["invalid request"] };
  }

  if (planningInput.kind === "inputText") {
    const dto: PlanningOriginatedExecutionRequestDto = { projectId, mode, planningInput };
    return { ok: true, dto };
  }
  const dto: PlanningOriginatedExecutionRequestDto = { projectId, mode, planningInput };
  return { ok: true, dto };
}

/** Alias for call sites that separate parse vs validate (parse is the validator here). */
export function validatePlanningExecutionRequest(body: unknown): PlanningExecutionRequestParseResult {
  return parsePlanningExecutionRequest(body);
}

export function planningOriginatedExecutionInputFromDto(
  dto: PlanningOriginatedExecutionRequestDto
): PlanningOriginatedExecutionInput {
  if (dto.planningInput.kind === "inputText") {
    return { projectId: dto.projectId, inputText: dto.planningInput.inputText, mode: dto.mode };
  }
  return { projectId: dto.projectId, refinement: dto.planningInput.refinement, mode: dto.mode };
}

function isLoosePrepareRequirementRefinementDecisionResult(
  v: unknown
): v is PrepareRequirementRefinementDecisionResult {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.normalizedText !== "string") return false;
  if (!Array.isArray(o.drafts)) return false;
  if (!o.gapViewModel || typeof o.gapViewModel !== "object" || Array.isArray(o.gapViewModel)) return false;
  if (!o.refinementDecision || typeof o.refinementDecision !== "object" || Array.isArray(o.refinementDecision)) return false;
  if (!Array.isArray(o.refinedRequirements)) return false;
  if (!o.readinessResult || typeof o.readinessResult !== "object" || Array.isArray(o.readinessResult)) return false;
  return true;
}
