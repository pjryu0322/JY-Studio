/**
 * MVP — draft `RunStore` adapter for a future Prisma-backed implementation (no DB client here).
 */

import type { ExecutionRun } from "../../contracts/mvpExecutionTypes";
import type { RunMeta, RunStore } from "../../ports/mvpPorts";

function notImplemented(): never {
  throw new Error("NOT_IMPLEMENTED_IN_MVP: MvpDraftPrismaRunStoreAdapter");
}

/**
 * Placeholder implementing `RunStore`; swap for a real Prisma repository when wiring production.
 * The default `mvpExecutionPortsBundle` must not use this class.
 */
export class MvpDraftPrismaRunStoreAdapter implements RunStore {
  get(_runId: string): ExecutionRun | undefined {
    notImplemented();
  }

  put(_run: ExecutionRun): void {
    notImplemented();
  }

  clear(): void {
    notImplemented();
  }

  getMeta(_runId: string): RunMeta | undefined {
    notImplemented();
  }

  setMeta(_runId: string, _meta: RunMeta): void {
    notImplemented();
  }

  deleteMeta(_runId: string): void {
    notImplemented();
  }
}
