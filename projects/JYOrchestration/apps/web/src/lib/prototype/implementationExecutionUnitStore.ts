import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { mergeExecutionUnitListsWithTerminalGuard, mergeExecutionUnitWithTerminalGuard } from "@/lib/prototype/implementationExecutionUnitTerminalGuard";
import { prisma } from "@/lib/prisma";
import {
  mergeRequirementsStateJson,
  parseRequirementsStateJson,
  type RequirementsStateJson,
} from "@/lib/requirements/requirementsStateJson";

export const IMPLEMENTATION_EXECUTION_UNITS_STATE_VERSION =
  "implementation_execution_units_v1" as const;

export type ImplementationExecutionUnitsStateV1 = Readonly<{
  readonly version: typeof IMPLEMENTATION_EXECUTION_UNITS_STATE_VERSION;
  readonly projectId: string;
  readonly updatedAt: string;
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedExecutionUnitIds?: readonly string[];
}>;

const UNIT_STATUSES = new Set<ImplementationExecutionUnitV1["status"]>([
  "ready",
  "blocked",
  "running",
  "verifying",
  "verified",
  "failed",
  "skipped",
]);

function readString(value: unknown): string {
  return String(value ?? "").trim();
}

function parseUnit(raw: unknown): ImplementationExecutionUnitV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const unitId = readString(o.unitId);
  const codeTaskId = readString(o.codeTaskId);
  const processTaskId = readString(o.processTaskId);
  const status = readString(o.status) as ImplementationExecutionUnitV1["status"];
  if (!unitId || !codeTaskId || !UNIT_STATUSES.has(status)) return null;
  return {
    unitId,
    codeTaskId,
    processTaskId,
    title: readString(o.title) || codeTaskId,
    order: Number(o.order) || 0,
    branchGroup:
      (readString(o.branchGroup) as ImplementationExecutionUnitV1["branchGroup"]) || "data",
    baseBranch: readString(o.baseBranch) || "main",
    workBranch: readString(o.workBranch),
    dependencies: Array.isArray(o.dependencies)
      ? o.dependencies.map((d) => readString(d)).filter(Boolean)
      : [],
    status,
    ...(o.retryable === false ? { retryable: false } : o.retryable === true ? { retryable: true } : {}),
    ...(o.runId != null ? { runId: readString(o.runId) || null } : {}),
    ...(o.startedAt != null ? { startedAt: readString(o.startedAt) || null } : {}),
    ...(o.verifyingAt != null ? { verifyingAt: readString(o.verifyingAt) || null } : {}),
    ...(o.verifiedAt != null ? { verifiedAt: readString(o.verifiedAt) || null } : {}),
    ...(o.failedAt != null ? { failedAt: readString(o.failedAt) || null } : {}),
    ...(o.beforeHeadSha != null ? { beforeHeadSha: readString(o.beforeHeadSha) || null } : {}),
    ...(o.afterHeadSha != null ? { afterHeadSha: readString(o.afterHeadSha) || null } : {}),
    ...(o.commitSha != null ? { commitSha: readString(o.commitSha) || null } : {}),
    ...(o.errorCode != null ? { errorCode: readString(o.errorCode) || null } : {}),
    ...(o.errorMessage != null ? { errorMessage: readString(o.errorMessage) || null } : {}),
  };
}

export function parseImplementationExecutionUnitsStateV1(
  raw: unknown,
): ImplementationExecutionUnitsStateV1 | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (readString(o.version) !== IMPLEMENTATION_EXECUTION_UNITS_STATE_VERSION) return null;
  const projectId = readString(o.projectId);
  const updatedAt = readString(o.updatedAt);
  if (!projectId || !updatedAt) return null;
  const units: ImplementationExecutionUnitV1[] = [];
  for (const row of Array.isArray(o.units) ? o.units : []) {
    const unit = parseUnit(row);
    if (unit) units.push(unit);
  }
  const selectedExecutionUnitIds = Array.isArray(o.selectedExecutionUnitIds)
    ? o.selectedExecutionUnitIds.map((id) => readString(id)).filter(Boolean)
    : undefined;
  return {
    version: IMPLEMENTATION_EXECUTION_UNITS_STATE_VERSION,
    projectId,
    updatedAt,
    units,
    ...(selectedExecutionUnitIds?.length ? { selectedExecutionUnitIds } : {}),
  };
}

export function loadImplementationExecutionUnitsFromState(
  state: RequirementsStateJson | null | undefined,
): readonly ImplementationExecutionUnitV1[] {
  return state?.implementationExecutionUnitsV1?.units ?? [];
}

export function saveImplementationExecutionUnitsToState(input: {
  readonly projectId: string;
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly reason: string;
  readonly selectedExecutionUnitIds?: readonly string[] | null;
  readonly nowIso?: string;
  readonly mergeTerminalGuardFrom?: readonly ImplementationExecutionUnitV1[] | null;
}): Partial<RequirementsStateJson> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const selectedExecutionUnitIds =
    input.selectedExecutionUnitIds != null
      ? input.selectedExecutionUnitIds.map((id) => id.trim()).filter(Boolean)
      : undefined;
  let units = input.units;
  if (input.mergeTerminalGuardFrom?.length) {
    units = mergeExecutionUnitListsWithTerminalGuard({
      previous: input.mergeTerminalGuardFrom,
      next: input.units,
      reason: input.reason,
    }).units;
  }
  return {
    implementationExecutionUnitsV1: {
      version: IMPLEMENTATION_EXECUTION_UNITS_STATE_VERSION,
      projectId: input.projectId.trim(),
      updatedAt: nowIso,
      units: [...units],
      ...(selectedExecutionUnitIds !== undefined ? { selectedExecutionUnitIds } : {}),
    },
  };
}

export function patchImplementationExecutionUnitInState(input: {
  readonly state: RequirementsStateJson;
  readonly projectId: string;
  readonly unitId: string;
  readonly patch: Partial<ImplementationExecutionUnitV1>;
  readonly reason: string;
  readonly nowIso?: string;
}): Readonly<{
  readonly unit: ImplementationExecutionUnitV1 | null;
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
}> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const existing = loadImplementationExecutionUnitsFromState(input.state);
  const idx = existing.findIndex((u) => u.unitId === input.unitId.trim());
  if (idx < 0) {
    return { unit: null, orchestrationPatch: {} };
  }
  const current = existing[idx]!;
  const guarded = mergeExecutionUnitWithTerminalGuard({
    current,
    patch: input.patch,
    reason: input.reason,
  });
  const nextUnit = guarded.unit;
  const units = [...existing];
  units[idx] = nextUnit;
  return {
    unit: nextUnit,
    orchestrationPatch: saveImplementationExecutionUnitsToState({
      projectId: input.projectId,
      units,
      selectedExecutionUnitIds: input.state.implementationExecutionUnitsV1?.selectedExecutionUnitIds ?? [],
      reason: input.reason,
      nowIso,
      mergeTerminalGuardFrom: existing,
    }),
  };
}

export async function loadImplementationExecutionUnits(input: {
  readonly projectId: string;
}): Promise<readonly ImplementationExecutionUnitV1[]> {
  const pid = input.projectId.trim();
  if (!pid) return [];
  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const state = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  return loadImplementationExecutionUnitsFromState(state);
}

export async function saveImplementationExecutionUnits(input: {
  readonly projectId: string;
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly reason: string;
  readonly nowIso?: string;
}): Promise<void> {
  const pid = input.projectId.trim();
  if (!pid) return;
  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const persisted = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  const patch = saveImplementationExecutionUnitsToState(input);
  const merged = mergeRequirementsStateJson(persisted, patch);
  await prisma.project.update({
    where: { id: pid },
    data: { requirementsStateJson: merged as object },
  });
}

export async function patchImplementationExecutionUnit(input: {
  readonly projectId: string;
  readonly unitId: string;
  readonly patch: Partial<ImplementationExecutionUnitV1>;
  readonly reason: string;
  readonly nowIso?: string;
}): Promise<ImplementationExecutionUnitV1 | null> {
  const pid = input.projectId.trim();
  const row = await prisma.project.findUnique({
    where: { id: pid },
    select: { requirementsStateJson: true },
  });
  const persisted = parseRequirementsStateJson(row?.requirementsStateJson) ?? {};
  const { unit, orchestrationPatch } = patchImplementationExecutionUnitInState({
    state: persisted,
    projectId: pid,
    unitId: input.unitId,
    patch: input.patch,
    reason: input.reason,
    nowIso: input.nowIso,
  });
  if (!unit) return null;
  const merged = mergeRequirementsStateJson(persisted, orchestrationPatch);
  await prisma.project.update({
    where: { id: pid },
    data: { requirementsStateJson: merged as object },
  });
  return unit;
}
