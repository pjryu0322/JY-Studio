import {
  isExecutionUnitInFlight,
  isExecutionUnitTerminalForQueue,
  type ImplementationExecutionUnitV1,
} from "@/lib/prototype/implementationExecutionUnit";

export type ResolveNextExecutableUnitResultV1 =
  | Readonly<{ readonly status: "next"; readonly unit: ImplementationExecutionUnitV1 }>
  | Readonly<{ readonly status: "in_flight"; readonly unit: ImplementationExecutionUnitV1 }>
  | Readonly<{
      readonly status: "blocked";
      readonly unit: ImplementationExecutionUnitV1;
      readonly reason: string;
    }>
  | Readonly<{ readonly status: "complete" }>
  | Readonly<{ readonly status: "empty_selection" }>;

function unitById(
  units: readonly ImplementationExecutionUnitV1[],
): Map<string, ImplementationExecutionUnitV1> {
  return new Map(units.map((u) => [u.unitId, u]));
}

function dependenciesVerified(
  unit: ImplementationExecutionUnitV1,
  byId: Map<string, ImplementationExecutionUnitV1>,
): boolean {
  for (const dep of unit.dependencies) {
    const depUnit = byId.get(dep) ?? [...byId.values()].find((u) => u.codeTaskId === dep);
    if (!depUnit) continue;
    if (!isExecutionUnitTerminalForQueue(depUnit.status)) return false;
  }
  return true;
}

export function resolveNextExecutableUnit(input: {
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedUnitIds: readonly string[];
}): ResolveNextExecutableUnitResultV1 {
  const selected = input.selectedUnitIds.map((id) => id.trim()).filter(Boolean);
  if (!selected.length) return { status: "empty_selection" };

  const selectedSet = new Set(selected);
  const scoped = input.units.filter((u) => selectedSet.has(u.unitId));
  if (!scoped.length) return { status: "empty_selection" };

  const byId = unitById(input.units);

  for (const unit of scoped) {
    if (unit.status === "failed" && unit.retryable === false) {
      return { status: "blocked", unit, reason: "failed_unit_not_retryable" };
    }
  }

  const inFlight = scoped.find((u) => isExecutionUnitInFlight(u.status));
  if (inFlight) {
    return { status: "in_flight", unit: inFlight };
  }

  const pending = scoped.filter((u) => !isExecutionUnitTerminalForQueue(u.status));
  if (!pending.length) {
    return { status: "complete" };
  }

  const ordered = [...pending].sort((a, b) => a.order - b.order);
  for (const unit of ordered) {
    if (unit.status === "failed" && unit.retryable !== false) {
      if (dependenciesVerified(unit, byId)) {
        return { status: "next", unit };
      }
      return { status: "blocked", unit, reason: "dependencies_not_verified" };
    }
    if (unit.status === "ready" || unit.status === "blocked") {
      if (!dependenciesVerified(unit, byId)) {
        return { status: "blocked", unit, reason: "dependencies_not_verified" };
      }
      if (unit.status === "ready") {
        return { status: "next", unit };
      }
    }
    if (unit.status === "failed") {
      continue;
    }
  }

  const firstBlocked = ordered.find((u) => u.status === "blocked");
  if (firstBlocked) {
    return { status: "blocked", unit: firstBlocked, reason: "unit_blocked" };
  }

  return { status: "complete" };
}

export function reconcileSelectedExecutionUnitIds(input: {
  readonly selectedUnitIds: readonly string[];
  readonly units: readonly ImplementationExecutionUnitV1[];
}): Readonly<{
  readonly selectedUnitIds: readonly string[];
  readonly removedIds: readonly string[];
}> {
  const existing = new Set(input.units.map((u) => u.unitId));
  const removedIds: string[] = [];
  const kept: string[] = [];
  for (const id of input.selectedUnitIds) {
    const key = id.trim();
    if (!key) continue;
    if (!existing.has(key)) {
      removedIds.push(key);
      continue;
    }
    kept.push(key);
  }
  return { selectedUnitIds: kept, removedIds };
}

export function mapSelectedCodeTaskIdsToExecutionUnitIds(
  selectedCodeTaskIds: readonly string[],
): readonly string[] {
  return selectedCodeTaskIds.map((id) => id.trim()).filter(Boolean);
}

export function hasRemainingSelectedExecutionUnits(input: {
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedUnitIds: readonly string[];
}): boolean {
  const resolved = resolveNextExecutableUnit(input);
  return resolved.status !== "complete" && resolved.status !== "empty_selection";
}
