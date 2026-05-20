/**
 * Focus contention resolution — clarification > drawer > selection > inference.
 */

import type { FeatureDetailSlotsV1 } from "@/lib/requirements/featureDetailSlots";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type {
  ConversationFocusWire,
  RequirementsIntentOrchestrationV1,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";

export type FocusSource = "clarification" | "drawer" | "selection" | "inference";

const FOCUS_SOURCE_PRIORITY: Record<FocusSource, number> = {
  clarification: 100,
  drawer: 80,
  selection: 60,
  inference: 40,
};

export function focusWithSource(input: {
  readonly focus: ConversationFocusWire;
  readonly source: FocusSource;
}): ConversationFocusWire {
  return {
    ...input.focus,
    focusSource: input.source,
    focusPriority: FOCUS_SOURCE_PRIORITY[input.source],
  };
}

export function resolveContestedFocus(input: {
  readonly orchestration: RequirementsIntentOrchestrationV1 | null | undefined;
  readonly featureDetailSlotsV1?: FeatureDetailSlotsV1 | null;
  readonly serviceFlowV1?: RequirementsServiceFlowV1 | null;
  readonly drawerFeatureId?: string | null;
  readonly inferred?: ConversationFocusWire | null;
}): ConversationFocusWire | null {
  const candidates: ConversationFocusWire[] = [];

  if (input.orchestration?.clarification?.pending && input.orchestration.currentEditingTarget?.featureId) {
    const id = input.orchestration.currentEditingTarget.featureId;
    const slot = input.featureDetailSlotsV1?.slots.find((s) => s.id === id);
    candidates.push(
      focusWithSource({
        focus: { type: "feature", id, ...(slot?.title ? { label: slot.title } : {}) },
        source: "clarification",
      }),
    );
  }

  if (input.drawerFeatureId) {
    const slot = input.featureDetailSlotsV1?.slots.find((s) => s.id === input.drawerFeatureId);
    candidates.push(
      focusWithSource({
        focus: { type: "feature", id: input.drawerFeatureId, ...(slot?.title ? { label: slot.title } : {}) },
        source: "drawer",
      }),
    );
  }

  if (input.orchestration?.activeFocus?.id) {
    candidates.push(
      focusWithSource({
        focus: input.orchestration.activeFocus,
        source: (input.orchestration.activeFocus.focusSource as FocusSource) ?? "selection",
      }),
    );
  }

  if (input.inferred?.id) {
    candidates.push(focusWithSource({ focus: input.inferred, source: "inference" }));
  }

  if (!candidates.length) return null;

  return [...candidates].sort(
    (a, b) => (b.focusPriority ?? 0) - (a.focusPriority ?? 0),
  )[0]!;
}
