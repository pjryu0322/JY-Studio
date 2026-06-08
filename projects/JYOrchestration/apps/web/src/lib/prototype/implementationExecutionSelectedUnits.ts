import { buildImplementationExecutionLogTimelineEntry } from "@/lib/prototype/implementationExecutionLogTimeline";
import {
  mapSelectedCodeTaskIdsToExecutionUnitIds,
  reconcileSelectedExecutionUnitIds,
} from "@/lib/prototype/implementationExecutionScheduler";
import { findLatestRunForCodeTask, type CodeTaskExecutionRunV1 } from "@/lib/prototype/codeTaskExecutionRun";
import type { ImplementationExecutionUnitV1 } from "@/lib/prototype/implementationExecutionUnit";
import {
  isExecutionUnitCompletedForSummary,
  isExecutionUnitSkippedForSummary,
  resolveExecutionUnitVerificationDisplayStatus,
} from "@/lib/prototype/implementationExecutionUnitVerification";
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

  if (!selected.length && legacyIds.length) {
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

  const { selectedUnitIds, removedIds } = reconcileSelectedExecutionUnitIds({
    selectedUnitIds: selected.length ? selected : input.units.map((u) => u.unitId),
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
}> {
  const selected = input.selectedUnitIds.map((id) => id.trim()).filter(Boolean);
  const byId = new Map(input.units.map((u) => [u.unitId, u]));
  let completedCount = 0;
  const pendingCodeTaskIds: string[] = [];
  const inconsistentCodeTaskIds: string[] = [];

  for (const id of selected) {
    const unit = byId.get(id);
    if (!unit) {
      pendingCodeTaskIds.push(id);
      continue;
    }
    const run = findLatestRunForCodeTask(input.runs, unit.codeTaskId);
    const display = resolveExecutionUnitVerificationDisplayStatus({ unit, run });
    if (display === "verified" || display === "skipped") {
      completedCount += 1;
    } else if (display === "verification_inconsistent") {
      inconsistentCodeTaskIds.push(unit.codeTaskId);
    } else {
      pendingCodeTaskIds.push(unit.codeTaskId);
    }
  }

  return {
    ok:
      selected.length > 0 &&
      completedCount === selected.length &&
      inconsistentCodeTaskIds.length === 0 &&
      pendingCodeTaskIds.length === 0,
    completedCount,
    selectedCount: selected.length,
    pendingCodeTaskIds,
    inconsistentCodeTaskIds,
  };
}

export type SelectedExecutionUnitsCompletionGateV1 = Readonly<{
  readonly ok: boolean;
  readonly completedCount: number;
  readonly selectedCount: number;
  readonly pendingCodeTaskIds: readonly string[];
  readonly inconsistentCodeTaskIds: readonly string[];
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
      const run = findLatestRunForCodeTask(input.runs, unit.codeTaskId);
      if (
        isExecutionUnitCompletedForSummary({ unit, run }) ||
        isExecutionUnitSkippedForSummary({ unit, run })
      ) {
        n += 1;
      }
      continue;
    }
    if (unit.status === "verified" || unit.status === "skipped") n += 1;
  }
  return n;
}
