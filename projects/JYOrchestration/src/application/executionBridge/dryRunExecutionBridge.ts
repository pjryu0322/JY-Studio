/**
 * Validates preparation → bridge mapping **without** mutating MVP stores or starting a run.
 */

import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";
import { validateExecutionPreparationBundle } from "../executionPreparation/validateExecutionPreparationBundle";
import type { DryRunExecutionBridgeResult } from "./executionBridgeContracts";
import { buildExecutionBridgeInput } from "./buildExecutionBridgeInput";
import { validateExecutionBridgeInput } from "./validateExecutionBridgeInput";

export function dryRunExecutionBridge(bundle: ExecutionPreparationBundle): DryRunExecutionBridgeResult {
  const preparationValidation = validateExecutionPreparationBundle(bundle);
  if (!preparationValidation.ok) {
    return {
      ok: false,
      reason: preparationValidation.reasons.join(" | "),
      preparationValidation,
    };
  }

  const built = buildExecutionBridgeInput(bundle);
  if (!built.ok) {
    return { ok: false, reason: built.reason, preparationValidation };
  }

  const bridgeValidation = validateExecutionBridgeInput(built.input);
  if (!bridgeValidation.ok) {
    return {
      ok: false,
      reason: bridgeValidation.reasons.join(" | "),
      preparationValidation,
      bridgeInput: built.input,
      bridgeValidation,
    };
  }

  return {
    ok: true,
    preparationValidation,
    bridgeInput: built.input,
    bridgeValidation,
  };
}
