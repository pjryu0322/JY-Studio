/**
 * Seeds MVP in-memory stores from a validated {@link import("../executionPreparation/executionPreparationContracts").ExecutionPreparationBundle}
 * so {@link mvpStartExecutionUseCase} readiness matches planning-derived tasks.
 *
 * Bridge-only: not used by legacy `mvpSeedProjectTasks` + `startRun` flows directly.
 *
 * Pipeline: {@link buildMvpExecutionBridgeBootstrapFromPreparation} → {@link applyMvpExecutionBridgeBootstrap} →
 * {@link verifyMvpSeedPayloadApplied}.
 */

import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";
import { formatMvpSeedVerificationIssuesForError } from "./mvpSeedVerificationIssueModel";
import {
  applyMvpExecutionBridgeBootstrap,
  buildMvpExecutionBridgeBootstrapFromPreparation,
} from "./mvpExecutionBridgeBootstrap";
import { verifyMvpSeedPayloadApplied } from "./verifyMvpSeedPayloadApplied";

export async function applyExecutionPreparationToMvpStores(bundle: ExecutionPreparationBundle): Promise<void> {
  const bootstrap = buildMvpExecutionBridgeBootstrapFromPreparation(bundle);
  applyMvpExecutionBridgeBootstrap(bootstrap);
  const v = await verifyMvpSeedPayloadApplied(bootstrap.seedPayload);
  if (!v.ok) {
    throw new Error(`MVP bridge seed verification failed: ${formatMvpSeedVerificationIssuesForError(v.issues)}`);
  }
}
