/**
 * Seeds MVP in-memory stores from a validated {@link import("../executionPreparation/executionPreparationContracts").ExecutionPreparationBundle}
 * so {@link mvpStartExecutionUseCase} readiness matches planning-derived tasks.
 *
 * Bridge-only: not used by legacy `mvpSeedProjectTasks` + `startRun` flows directly.
 *
 * Pipeline: {@link buildMvpSeedPayloadFromExecutionPreparation} → {@link applyMvpSeedPayload} →
 * {@link verifyMvpSeedPayloadApplied}.
 */

import type { ExecutionPreparationBundle } from "../executionPreparation/executionPreparationContracts";
import { applyMvpSeedPayload } from "./applyMvpSeedPayload";
import { buildMvpSeedPayloadFromExecutionPreparation } from "./buildMvpSeedPayloadFromExecutionPreparation";
import { verifyMvpSeedPayloadApplied } from "./verifyMvpSeedPayloadApplied";

export async function applyExecutionPreparationToMvpStores(bundle: ExecutionPreparationBundle): Promise<void> {
  const payload = buildMvpSeedPayloadFromExecutionPreparation(bundle);
  applyMvpSeedPayload(payload);
  const v = await verifyMvpSeedPayloadApplied(payload);
  if (!v.ok) {
    throw new Error(`MVP bridge seed verification failed: ${v.issues.map((i) => i.code + (i.detail ? `(${i.detail})` : "")).join("; ")}`);
  }
}
