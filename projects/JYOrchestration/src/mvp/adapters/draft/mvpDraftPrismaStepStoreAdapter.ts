/**
 * MVP — draft `StepStore` adapter for a future Prisma-backed implementation (no DB client here).
 */

import type { MvpExecutionStepRecord } from "../../execution/executionStepLog";
import type { StepAppendInput, StepStore } from "../../ports/mvpPorts";

function notImplemented(): never {
  throw new Error("NOT_IMPLEMENTED_IN_MVP: MvpDraftPrismaStepStoreAdapter");
}

/**
 * Placeholder implementing `StepStore`; swap for a real Prisma append/query layer when wiring production.
 * The default `mvpExecutionPortsBundle` must not use this class.
 */
export class MvpDraftPrismaStepStoreAdapter implements StepStore {
  append(_record: StepAppendInput): void {
    notImplemented();
  }

  getStepsForRun(_runId: string): readonly MvpExecutionStepRecord[] {
    notImplemented();
  }

  clearAll(): void {
    notImplemented();
  }
}
