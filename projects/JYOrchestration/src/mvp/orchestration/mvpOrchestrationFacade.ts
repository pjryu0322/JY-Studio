/**
 * MVP — isolated orchestration facade (readiness + run lifecycle + projections). No HTTP/DB.
 */

import type { ExecutionRun } from "../contracts/mvpExecutionTypes";
import {
  toMvpExecutionStepDto,
  toMvpReadinessDto,
  toMvpRunDetailDto,
  toMvpRunSummaryDto,
  type MvpExecutionStepDto,
  type MvpReadinessDto,
  type MvpRunDetailDto,
  type MvpRunSummaryDto,
} from "../contracts/mvpDtos";
import { startRun } from "../execution/executionService";
import { mvpProjectRunDetail, mvpProjectRunSummary } from "../execution/mvpRunSummary";
import { mvpExecutionPortsBundle } from "../runtime/mvpExecutionPortsBundle";
import { evaluateExecutionReadiness, type ExecutionReadinessInput } from "./orchestrationService";

export type MvpStartRunIfReadyResult =
  | { ok: true; run: ExecutionRun; readiness: MvpReadinessDto }
  | { ok: false; reason: "NOT_READY"; readiness: MvpReadinessDto };

/**
 * Evaluates readiness and returns a DTO (uses the same rules as `evaluateExecutionReadiness`).
 */
export async function mvpCheckReadinessDto(input: ExecutionReadinessInput): Promise<MvpReadinessDto> {
  const r = await evaluateExecutionReadiness(input);
  return toMvpReadinessDto(r);
}

/**
 * Starts a run only when readiness passes; otherwise returns `NOT_READY` without mutating execution state for that attempt.
 */
export async function mvpStartRunIfReady(projectId: string): Promise<MvpStartRunIfReadyResult> {
  const readiness = await mvpCheckReadinessDto({ projectId });
  if (!readiness.isReady) {
    return { ok: false, reason: "NOT_READY", readiness };
  }
  const run = await startRun(projectId);
  return { ok: true, run, readiness };
}

/** Run summary as DTO (null if run id is unknown). */
export async function mvpGetRunSummaryDto(runId: string): Promise<MvpRunSummaryDto | null> {
  const p = await mvpProjectRunSummary(runId);
  if (!p) {
    return null;
  }
  return toMvpRunSummaryDto(p);
}

/** Detailed run inspection DTO (null if run id is unknown). */
export async function mvpGetRunDetailDto(runId: string): Promise<MvpRunDetailDto | null> {
  const p = await mvpProjectRunDetail(runId);
  if (!p) {
    return null;
  }
  return toMvpRunDetailDto(p);
}

/** Step log as DTOs (stable `sequence` order). */
export function mvpGetStepSummaryDtos(runId: string): MvpExecutionStepDto[] {
  return mvpExecutionPortsBundle().stepStore.getStepsForRun(runId).map(toMvpExecutionStepDto);
}

/** Compact textual flow from the step store. */
export function mvpGetStepFlowSummary(runId: string): string {
  return mvpExecutionPortsBundle()
    .stepStore.getStepsForRun(runId)
    .map((s) => `${s.sequence}:${s.stepType}`)
    .join(" → ");
}
