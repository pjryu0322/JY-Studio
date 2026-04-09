/**
 * Persistence-ready repository boundary for core Business Execution entities.
 *
 * In this phase the repository remains in-memory and session-scoped (via sessionResultStoreCore),
 * but its API is shaped to make later durable storage (DB/API) adoption straightforward.
 *
 * Core persisted-entity-like models covered here:
 * - BusinessExecutionRequest
 * - BusinessExecutionApproval
 * - BusinessExecutionPackage
 * - ExecutionAssignment
 * - BusinessExecutionRun
 *
 * Derived state (readiness, current/non-current, stale/invalid, next-action availability) MUST remain
 * computed in selectors/validators and should not be embedded into these entities.
 *
 * This repository is part of the Business Execution domain and must stay separate from Stage1/Stage2
 * environment/procedure test flows.
 */

import type { BusinessExecutionApproval } from "@/lib/workflow/businessExecutionApproval";
import type { BusinessExecutionPackage } from "@/lib/workflow/businessExecutionPackage";
import type { BusinessExecutionRequest } from "@/lib/workflow/businessExecutionRequest";
import type { BusinessExecutionRun } from "@/lib/workflow/businessExecutionRun";
import type { ExecutionAssignment } from "@/lib/workflow/executionAssignment";
import { getSessionEntry, updateSessionEntry } from "@/lib/workflow/sessionResultStoreCore";
import {
  hydrateBusinessExecutionCoreFromPersistence,
  loadBusinessExecutionCoreEntities,
  saveBusinessExecutionCoreEntities,
} from "@/lib/workflow/businessExecutionPersistence";

type BusinessExecutionCoreEntityEntry = {
  /** Latest-only policy per session (no history in this phase). */
  latestBusinessExecutionRequest?: BusinessExecutionRequest;
  latestBusinessExecutionApproval?: BusinessExecutionApproval;
  latestBusinessExecutionPackage?: BusinessExecutionPackage;
  latestExecutionAssignment?: ExecutionAssignment;
  latestBusinessExecutionRun?: BusinessExecutionRun;
  updatedAtIso?: string;
};

let hasHydratedAll = false;
const hydratedSessions = new Set<string>();

function hydrateAllOnce(): void {
  if (hasHydratedAll) return;
  hasHydratedAll = true;
  hydrateBusinessExecutionCoreFromPersistence();
}

function hydrateSessionOnce(sessionId: string): void {
  hydrateAllOnce();
  if (hydratedSessions.has(sessionId)) return;
  hydratedSessions.add(sessionId);
  const persisted = loadBusinessExecutionCoreEntities(sessionId);
  if (!persisted) return;
  updateSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestBusinessExecutionRequest: persisted.latestBusinessExecutionRequest,
    latestBusinessExecutionApproval: persisted.latestBusinessExecutionApproval,
    latestBusinessExecutionPackage: persisted.latestBusinessExecutionPackage,
    latestExecutionAssignment: persisted.latestExecutionAssignment,
    latestBusinessExecutionRun: persisted.latestBusinessExecutionRun,
    updatedAtIso: persisted.savedAtIso,
  }));
}

export function recordSessionBusinessExecutionRequest(
  sessionId: string,
  request: BusinessExecutionRequest
): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestBusinessExecutionRequest: request,
    updatedAtIso: at,
  }));
  saveBusinessExecutionCoreEntities({
    sessionId,
    core: {
      latestBusinessExecutionRequest: request,
      latestBusinessExecutionApproval: resolveSessionBusinessExecutionApproval(sessionId),
      latestBusinessExecutionPackage: resolveSessionBusinessExecutionPackage(sessionId),
      latestExecutionAssignment: resolveSessionExecutionAssignment(sessionId),
      latestBusinessExecutionRun: resolveSessionBusinessExecutionRun(sessionId),
    },
  });
}

export function resolveSessionBusinessExecutionRequest(
  sessionId: string | null | undefined
): BusinessExecutionRequest | undefined {
  if (!sessionId) return undefined;
  hydrateSessionOnce(sessionId);
  return getSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId)?.latestBusinessExecutionRequest;
}

export function sessionHasBusinessExecutionRequest(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  hydrateSessionOnce(sessionId);
  return getSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId)?.latestBusinessExecutionRequest !== undefined;
}

export function recordSessionBusinessExecutionApproval(
  sessionId: string,
  approval: BusinessExecutionApproval
): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestBusinessExecutionApproval: approval,
    updatedAtIso: at,
  }));
  saveBusinessExecutionCoreEntities({
    sessionId,
    core: {
      latestBusinessExecutionRequest: resolveSessionBusinessExecutionRequest(sessionId),
      latestBusinessExecutionApproval: approval,
      latestBusinessExecutionPackage: resolveSessionBusinessExecutionPackage(sessionId),
      latestExecutionAssignment: resolveSessionExecutionAssignment(sessionId),
      latestBusinessExecutionRun: resolveSessionBusinessExecutionRun(sessionId),
    },
  });
}

export function resolveSessionBusinessExecutionApproval(
  sessionId: string | null | undefined
): BusinessExecutionApproval | undefined {
  if (!sessionId) return undefined;
  hydrateSessionOnce(sessionId);
  return getSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId)?.latestBusinessExecutionApproval;
}

export function sessionHasBusinessExecutionApproval(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  hydrateSessionOnce(sessionId);
  return getSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId)?.latestBusinessExecutionApproval !== undefined;
}

export function recordSessionBusinessExecutionPackage(
  sessionId: string,
  pkg: BusinessExecutionPackage
): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestBusinessExecutionPackage: pkg,
    updatedAtIso: at,
  }));
  saveBusinessExecutionCoreEntities({
    sessionId,
    core: {
      latestBusinessExecutionRequest: resolveSessionBusinessExecutionRequest(sessionId),
      latestBusinessExecutionApproval: resolveSessionBusinessExecutionApproval(sessionId),
      latestBusinessExecutionPackage: pkg,
      latestExecutionAssignment: resolveSessionExecutionAssignment(sessionId),
      latestBusinessExecutionRun: resolveSessionBusinessExecutionRun(sessionId),
    },
  });
}

export function resolveSessionBusinessExecutionPackage(
  sessionId: string | null | undefined
): BusinessExecutionPackage | undefined {
  if (!sessionId) return undefined;
  hydrateSessionOnce(sessionId);
  return getSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId)?.latestBusinessExecutionPackage;
}

export function sessionHasBusinessExecutionPackage(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  hydrateSessionOnce(sessionId);
  return getSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId)?.latestBusinessExecutionPackage !== undefined;
}

export function recordSessionExecutionAssignment(
  sessionId: string,
  assignment: ExecutionAssignment
): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestExecutionAssignment: assignment,
    updatedAtIso: at,
  }));
  saveBusinessExecutionCoreEntities({
    sessionId,
    core: {
      latestBusinessExecutionRequest: resolveSessionBusinessExecutionRequest(sessionId),
      latestBusinessExecutionApproval: resolveSessionBusinessExecutionApproval(sessionId),
      latestBusinessExecutionPackage: resolveSessionBusinessExecutionPackage(sessionId),
      latestExecutionAssignment: assignment,
      latestBusinessExecutionRun: resolveSessionBusinessExecutionRun(sessionId),
    },
  });
}

export function resolveSessionExecutionAssignment(
  sessionId: string | null | undefined
): ExecutionAssignment | undefined {
  if (!sessionId) return undefined;
  hydrateSessionOnce(sessionId);
  return getSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId)?.latestExecutionAssignment;
}

export function sessionHasExecutionAssignment(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  hydrateSessionOnce(sessionId);
  return getSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId)?.latestExecutionAssignment !== undefined;
}

export function recordSessionBusinessExecutionRun(sessionId: string, run: BusinessExecutionRun): void {
  const at = new Date().toISOString();
  updateSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId, (prev) => ({
    ...(prev ?? {}),
    latestBusinessExecutionRun: run,
    updatedAtIso: at,
  }));
  saveBusinessExecutionCoreEntities({
    sessionId,
    core: {
      latestBusinessExecutionRequest: resolveSessionBusinessExecutionRequest(sessionId),
      latestBusinessExecutionApproval: resolveSessionBusinessExecutionApproval(sessionId),
      latestBusinessExecutionPackage: resolveSessionBusinessExecutionPackage(sessionId),
      latestExecutionAssignment: resolveSessionExecutionAssignment(sessionId),
      latestBusinessExecutionRun: run,
    },
  });
}

export function resolveSessionBusinessExecutionRun(
  sessionId: string | null | undefined
): BusinessExecutionRun | undefined {
  if (!sessionId) return undefined;
  hydrateSessionOnce(sessionId);
  return getSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId)?.latestBusinessExecutionRun;
}

export function sessionHasBusinessExecutionRun(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  hydrateSessionOnce(sessionId);
  return getSessionEntry<BusinessExecutionCoreEntityEntry>(sessionId)?.latestBusinessExecutionRun !== undefined;
}

/**
 * Currency policy helpers (explicit latest/current rules).
 *
 * - latest request per session
 * - latest approval must match latest request
 * - latest package must match latest request+approval
 * - latest assignment must match latest package
 *
 * Note: run currency against launch artifacts is computed in selectors (isBusinessExecutionRunCurrent),
 * but we still expose a simple runId linkage check for persistence-friendly chaining.
 */
export function resolveCoreEntityChainForSession(sessionId: string | null | undefined): {
  request: BusinessExecutionRequest | undefined;
  approval: BusinessExecutionApproval | undefined;
  pkg: BusinessExecutionPackage | undefined;
  assignment: ExecutionAssignment | undefined;
  run: BusinessExecutionRun | undefined;
} {
  const request = resolveSessionBusinessExecutionRequest(sessionId);
  const approval = resolveSessionBusinessExecutionApproval(sessionId);
  const pkg = resolveSessionBusinessExecutionPackage(sessionId);
  const assignment = resolveSessionExecutionAssignment(sessionId);
  const run = resolveSessionBusinessExecutionRun(sessionId);
  return { request, approval, pkg, assignment, run };
}

