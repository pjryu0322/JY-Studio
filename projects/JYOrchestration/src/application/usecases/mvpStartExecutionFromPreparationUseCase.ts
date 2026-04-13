/**
 * Guarded execution entry from {@link import("../executionPreparation/executionPreparationContracts").ExecutionPreparationBundle}.
 *
 * Flow: validate preparation → build bridge input → validate bridge → seed MVP stores →
 * {@link mvpStartExecutionUseCase} (existing application entry; no `executionService` internals changed).
 */

import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";
import { validateExecutionPreparationBundle } from "../executionPreparation/validateExecutionPreparationBundle";
import type { ExecutionBridgeStartResult } from "../executionBridge/executionBridgeContracts";
import { applyExecutionPreparationToMvpStores } from "../executionBridge/applyExecutionPreparationToMvpStores";
import { buildExecutionBridgeInput } from "../executionBridge/buildExecutionBridgeInput";
import { validateExecutionBridgeInput } from "../executionBridge/validateExecutionBridgeInput";
import { mvpStartExecutionUseCase } from "./mvpStartExecutionUseCase";

export async function mvpStartExecutionFromPreparationUseCase(
  bundle: ExecutionPreparationBundle
): Promise<ExecutionBridgeStartResult> {
  const pv = validateExecutionPreparationBundle(bundle);
  if (!pv.ok) {
    return { ok: false, reason: pv.reasons.join(" | ") };
  }

  const built = buildExecutionBridgeInput(bundle);
  if (!built.ok) {
    return { ok: false, reason: built.reason };
  }

  const bv = validateExecutionBridgeInput(built.input);
  if (!bv.ok) {
    return { ok: false, reason: bv.reasons.join(" | ") };
  }

  applyExecutionPreparationToMvpStores(bundle);

  const started = await mvpStartExecutionUseCase({ projectId: bundle.projectId });
  if (!started.ok) {
    return { ok: false, reason: `START_NOT_OK:${started.code}` };
  }

  return { ok: true, runId: started.runId, sourceTaskCount: built.input.tasks.length };
}
