/**
 * Bridge bootstrap contracts: explicit shape for MVP store seeding derived from
 * {@link import("../executionPreparation/executionPreparationContracts").ExecutionPreparationBundle}.
 *
 * Synthetic artifacts here exist only to satisfy MVP menu/screen invariants for the
 * planning → execution bridge; they are not produced by the planning IA artifact pipeline.
 */

import type { MvpScreen } from "../../mvp/domain/mvpDomainTypes";
import type { Task } from "../../mvp/task/taskService";

/** Discriminator for bridge-only menu bootstrap rows (not handoff IA nodes). */
export const BRIDGE_BOOTSTRAP_SYNTHETIC_ROOT_MENU_KIND = "BRIDGE_SYNTHETIC_ROOT_MENU" as const;

/**
 * Single synthetic root menu used when the preparation bundle carries screens without
 * cloning full IA trees. Intent is explicit for readers and static checks.
 */
export type BridgeSyntheticRootMenuSpec = {
  readonly kind: typeof BRIDGE_BOOTSTRAP_SYNTHETIC_ROOT_MENU_KIND;
  readonly id: string;
  readonly projectId: string;
  /** Human-readable label; not a planning artifact name. */
  readonly displayName: string;
  readonly parentId: null;
  readonly order: 0;
};

/** Deterministic id for the synthetic root menu (stable per project). */
export function buildSyntheticBridgeRootMenuId(projectId: string): string {
  return `mvp-bridge-menu-root-${projectId}`;
}

/** Builds the canonical synthetic root menu descriptor for bridge MVP seeding. */
export function createBridgeSyntheticRootMenuSpec(projectId: string): BridgeSyntheticRootMenuSpec {
  return {
    kind: BRIDGE_BOOTSTRAP_SYNTHETIC_ROOT_MENU_KIND,
    id: buildSyntheticBridgeRootMenuId(projectId),
    projectId,
    /** Same visible name as pre-split bridge seed (behavior-stable). */
    displayName: "Planning bridge",
    parentId: null,
    order: 0,
  };
}

/**
 * Canonical payload applied to MVP in-memory stores before `mvpStartExecutionUseCase`.
 * Maps preparation → concrete menu/screen/task rows in one place.
 */
export type MvpBridgeSeedPayload = {
  readonly projectId: string;
  /** Bridge-only bootstrap: one synthetic root menu (see {@link BridgeSyntheticRootMenuSpec}). */
  readonly syntheticRootMenu: BridgeSyntheticRootMenuSpec;
  readonly screens: readonly MvpScreen[];
  /** Dense `finalOrder` 0..n-1; MOCKUP functional tasks. */
  readonly tasks: readonly Task[];
};
