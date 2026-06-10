import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  mapSelectedCodeTaskIdsToExecutionUnitIds,
  reconcileSelectedExecutionUnitIds,
} from "@/lib/prototype/implementationExecutionScheduler";
import { coalesceCodeTaskExecutionRunsV1, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import { resolveAuthoritativeCodeTaskOutcome } from "@/lib/prototype/implementationCodeTaskOutcomeResolver";
import {
  loadImplementationExecutionUnitsFromState,
  saveImplementationExecutionUnitsToState,
} from "@/lib/prototype/implementationExecutionUnitStore";
import type { RequirementsPromptTimelineEntry } from "@/lib/requirements/requirementsStateJson";
import type { RequirementsStateJson } from "@/lib/requirements/requirementsStateJson";

export function loadPersistedSelectedExecutionUnitIds(
  state: RequirementsStateJson | null | undefined,
): readonly string[] {
  const raw = state?.implementationExecutionUnitsV1?.selectedExecutionUnitIds;
  if (!Array.isArray(raw)) return [];
  return raw.map((id) => String(id ?? "").trim()).filter(Boolean);
}

export function reconcileImplementationExecutionSelectedUnits(input: {
  readonly projectId: string;
  readonly state: RequirementsStateJson;
  readonly units: readonly ImplementationExecutionUnitV1[];
  /** Legacy UI / job input — migrated once when persisted selection is empty */
  readonly legacySelectedCodeTaskIds?: readonly string[] | null;
  /** When true, board selectedCodeTaskIds (including []) override persisted unit selection. */
  readonly boardSelectionExplicit?: boolean;
  readonly nowIso?: string;
}): Readonly<{
  readonly selectedUnitIds: readonly string[];
  readonly orchestrationPatch: Partial<RequirementsStateJson>;
  readonly timeline: readonly RequirementsPromptTimelineEntry[];
}> {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const pid = input.projectId.trim();
  const timeline: RequirementsPromptTimelineEntry[] = [];
  let orchestrationPatch: Partial<RequirementsStateJson> = {};

  let selected = loadPersistedSelectedExecutionUnitIds(input.state);
  const legacyIds = (input.legacySelectedCodeTaskIds ?? [])
    .map((id) => id.trim())
    .filter(Boolean);

  const boardExplicit =
    input.boardSelectionExplicit === true ||
    (input.legacySelectedCodeTaskIds !== undefined && input.legacySelectedCodeTaskIds !== null);

  if (boardExplicit) {
    selected = mapSelectedCodeTaskIdsToExecutionUnitIds(legacyIds, input.units);
  } else if (!selected.length && legacyIds.length) {
    selected = mapSelectedCodeTaskIdsToExecutionUnitIds(legacyIds, input.units);
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: "legacy_selected_code_task_ids_migrated",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: pid,
          legacyCount: legacyIds.length,
          migratedCount: selected.length,
        },
        nowIso,
      }),
    );
  }

  const defaultAllUnitIds = input.units.map((u) => u.unitId);
  const { selectedUnitIds, removedIds } = reconcileSelectedExecutionUnitIds({
    selectedUnitIds:
      selected.length > 0
        ? selected
        : boardExplicit
          ? []
          : defaultAllUnitIds,
    units: input.units,
  });

  const persistedBefore = loadPersistedSelectedExecutionUnitIds(input.state);
  const changed =
    removedIds.length > 0 ||
    persistedBefore.length !== selectedUnitIds.length ||
    persistedBefore.some((id, i) => id !== selectedUnitIds[i]);

  if (changed) {
    orchestrationPatch = saveImplementationExecutionUnitsToState({
      projectId: pid,
      units: [...input.units],
      selectedExecutionUnitIds: selectedUnitIds,
      reason: "implementation_selected_units_persisted",
      nowIso,
      mergeTerminalGuardFrom: loadImplementationExecutionUnitsFromState(input.state),
    });
    timeline.push(
      buildImplementationExecutionLogTimelineEntry({
        action: removedIds.length
          ? "implementation_selected_units_reconciled"
          : "implementation_selected_units_persisted",
        orchestrationTraceGroup: "implementation_orchestration",
        fields: {
          projectId: pid,
          selectedCount: selectedUnitIds.length,
          removedCount: removedIds.length,
        },
        nowIso,
      }),
    );
  }

  return { selectedUnitIds, orchestrationPatch, timeline };
}

export function areAllSelectedExecutionUnitsVerified(input: {
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedUnitIds: readonly string[];
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): boolean {
  if (input.runs != null) {
    return areAllSelectedExecutionUnitsVerifiedWithRuns({
      units: input.units,
      selectedUnitIds: input.selectedUnitIds,
      runs: input.runs,
    });
  }
  const selected = input.selectedUnitIds.map((id) => id.trim()).filter(Boolean);
  if (!selected.length) return false;
  const byId = new Map(input.units.map((u) => [u.unitId, u]));
  for (const id of selected) {
    const unit = byId.get(id);
    if (!unit) return false;
    if (unit.status !== "verified" && unit.status !== "skipped") return false;
  }
  return true;
}

export function areAllSelectedExecutionUnitsVerifiedWithRuns(input: {
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedUnitIds: readonly string[];
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): boolean {
  return areSelectedExecutionUnitsCompletedWithPersistedOutcomes(input).ok;
}

export function areSelectedExecutionUnitsCompletedWithPersistedOutcomes(input: {
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedUnitIds: readonly string[];
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): Readonly<{
  readonly ok: boolean;
  readonly completedCount: number;
  readonly selectedCount: number;
  readonly pendingCodeTaskIds: readonly string[];
  readonly inconsistentCodeTaskIds: readonly string[];
  readonly failedCodeTaskIds: readonly string[];
}> {
  const selected = input.selectedUnitIds.map((id) => id.trim()).filter(Boolean);
  const byId = new Map(input.units.map((u) => [u.unitId, u]));
  const runs = coalesceCodeTaskExecutionRunsV1(input.runs);
  let completedCount = 0;
  const pendingCodeTaskIds: string[] = [];
  const inconsistentCodeTaskIds: string[] = [];
  const failedCodeTaskIds: string[] = [];

  for (const id of selected) {
    const unit = byId.get(id);
    if (!unit) {
      pendingCodeTaskIds.push(id);
      continue;
    }
    const outcome = resolveAuthoritativeCodeTaskOutcome({ unit, runs });
    if (outcome.status === "verified" || outcome.status === "skipped") {
      completedCount += 1;
    } else if (outcome.status === "failed") {
      failedCodeTaskIds.push(unit.codeTaskId);
    } else if (outcome.status === "inconsistent") {
      inconsistentCodeTaskIds.push(unit.codeTaskId);
    } else {
      pendingCodeTaskIds.push(unit.codeTaskId);
    }
  }

  return {
    ok:
      selected.length > 0 &&
      completedCount === selected.length &&
      failedCodeTaskIds.length === 0 &&
      inconsistentCodeTaskIds.length === 0 &&
      pendingCodeTaskIds.length === 0,
    completedCount,
    selectedCount: selected.length,
    pendingCodeTaskIds,
    inconsistentCodeTaskIds,
    failedCodeTaskIds,
  };
}

export type SelectedExecutionUnitsCompletionGateV1 = Readonly<{
  readonly ok: boolean;
  readonly completedCount: number;
  readonly selectedCount: number;
  readonly pendingCodeTaskIds: readonly string[];
  readonly inconsistentCodeTaskIds: readonly string[];
  readonly failedCodeTaskIds: readonly string[];
}>;

export function countVerifiedSelectedExecutionUnits(input: {
  readonly units: readonly ImplementationExecutionUnitV1[];
  readonly selectedUnitIds: readonly string[];
  readonly runs?: readonly CodeTaskExecutionRunV1[] | null;
}): number {
  const selected = new Set(input.selectedUnitIds.map((id) => id.trim()).filter(Boolean));
  let n = 0;
  for (const unit of input.units) {
    if (!selected.has(unit.unitId)) continue;
    if (input.runs != null) {
      const runs = coalesceCodeTaskExecutionRunsV1(input.runs);
      const outcome = resolveAuthoritativeCodeTaskOutcome({ unit, runs });
      if (outcome.status === "verified" || outcome.status === "skipped") {
        n += 1;
      }
      continue;
    }
    if (unit.status === "verified" || unit.status === "skipped") n += 1;
  }
  return n;
}
