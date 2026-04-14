/**
 * Internal execution bootstrap: wraps {@link MvpBridgeSeedPayload} with provenance so
 * preparation → store seed is one explicit unit above the raw payload (behavior unchanged).
 */

import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";
import type { MvpBridgeSeedPayload } from "./mvpBridgeBootstrapContracts";
import { buildMvpSeedPayloadFromExecutionPreparation } from "./buildMvpSeedPayloadFromExecutionPreparation";
import { applyMvpSeedPayload } from "./applyMvpSeedPayload";

export const MVP_EXECUTION_BRIDGE_BOOTSTRAP_KIND = "MVP_EXECUTION_BRIDGE_BOOTSTRAP" as const;

export type MvpExecutionBridgeBootstrap = {
  readonly kind: typeof MVP_EXECUTION_BRIDGE_BOOTSTRAP_KIND;
  readonly source: "EXECUTION_PREPARATION";
  readonly projectId: string;
  /** Concrete rows applied to MVP menu/screen/task stores. */
  readonly seedPayload: MvpBridgeSeedPayload;
};

/** Alias: thin “execution bootstrap” name over the same bridge bootstrap row (no behavior change). */
export type ExecutionBootstrapPayload = MvpExecutionBridgeBootstrap;

export function buildMvpExecutionBridgeBootstrapFromPreparation(
  bundle: ExecutionPreparationBundle
): MvpExecutionBridgeBootstrap {
  return {
    kind: MVP_EXECUTION_BRIDGE_BOOTSTRAP_KIND,
    source: "EXECUTION_PREPARATION",
    projectId: bundle.projectId,
    seedPayload: buildMvpSeedPayloadFromExecutionPreparation(bundle),
  };
}

export function applyMvpExecutionBridgeBootstrap(bootstrap: MvpExecutionBridgeBootstrap): void {
  applyMvpSeedPayload(bootstrap.seedPayload);
}
