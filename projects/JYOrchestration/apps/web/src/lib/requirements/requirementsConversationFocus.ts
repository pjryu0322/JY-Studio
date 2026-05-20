/**
 * Active focus manager — pronoun / deictic utterances tie to current editing target.
 */

import type { FeatureDetailSlotsV1 } from "@/lib/requirements/featureDetailSlots";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";
import type {
  ConversationFocusWire,
  RequirementsIntentOrchestrationV1,
} from "@/lib/requirements/requirementsIntentOrchestrationWire";

export type ConversationFocusContext = Readonly<{
  readonly orchestration: RequirementsIntentOrchestrationV1 | null | undefined;
  readonly featureDetailSlotsV1?: FeatureDetailSlotsV1 | null;
  readonly serviceFlowV1?: RequirementsServiceFlowV1 | null;
}>;

export function resolveActiveFocus(ctx: ConversationFocusContext): ConversationFocusWire | null {
  const orch = ctx.orchestration;
  if (orch?.activeFocus?.id) return orch.activeFocus;

  const featureId = orch?.currentEditingTarget?.featureId ?? ctx.featureDetailSlotsV1?.focusFeatureId;
  if (featureId) {
    const slot = ctx.featureDetailSlotsV1?.slots.find((s) => s.id === featureId);
    return {
      type: "feature",
      id: featureId,
      ...(slot?.title ? { label: slot.title } : {}),
    };
  }

  const stepId = orch?.currentEditingTarget?.stepId;
  if (stepId) {
    const step = ctx.serviceFlowV1?.steps?.find((s) => s.id === stepId);
    return {
      type: "step",
      id: stepId,
      ...(step?.title ? { label: step.title } : {}),
    };
  }

  return null;
}

const DEICTIC_PATTERN = /^(그거|그건|이거|이건|그것|이것|그\s*기능|이\s*기능|그\s*단계|이\s*단계|그대로|유지)/;

export function messageRefersToActiveFocus(userMessage: string): boolean {
  const msg = String(userMessage ?? "").trim().toLowerCase();
  return DEICTIC_PATTERN.test(msg);
}

export function inferFocusFromMessage(
  userMessage: string,
  ctx: ConversationFocusContext,
): ConversationFocusWire | null {
  const existing = resolveActiveFocus(ctx);
  if (existing && messageRefersToActiveFocus(userMessage)) return existing;

  const msg = String(userMessage ?? "").trim().toLowerCase();
  const slots = ctx.featureDetailSlotsV1?.slots ?? [];
  for (const slot of slots) {
    const title = slot.title.trim().toLowerCase();
    if (title.length >= 2 && msg.includes(title.slice(0, Math.min(12, title.length)))) {
      return { type: "feature", id: slot.id, label: slot.title };
    }
    if (/업로드|녹취|pdf|오디오/.test(msg) && /업로드|녹취|파일/.test(title)) {
      return { type: "feature", id: slot.id, label: slot.title };
    }
  }

  return existing;
}

export function focusReasonForRouting(focus: ConversationFocusWire | null): string | undefined {
  if (!focus) return undefined;
  return `activeFocus:${focus.type}:${focus.id}`;
}

/** Persisted focus for feature drawer / slot selection (not message parsing). */
export function buildFeatureEditingFocus(input: {
  readonly featureId: string;
  readonly label?: string;
  readonly stage?: string;
  readonly nowIso?: string;
}): ConversationFocusWire {
  const now = input.nowIso ?? new Date().toISOString();
  return {
    type: "feature",
    id: input.featureId,
    ...(input.label?.trim() ? { label: input.label.trim().slice(0, 120) } : {}),
    confidence: 0.85,
    lastReferencedAt: now,
    referenceCount: 1,
    focusSetAtStage: input.stage,
    softStale: false,
  };
}

export function buildCurrentEditingTargetForFeature(featureId: string): NonNullable<
  RequirementsIntentOrchestrationV1["currentEditingTarget"]
> {
  return { featureId };
}

export function updateFocusAfterAction(input: {
  readonly actionId: QuickActionId;
  readonly focus: ConversationFocusWire | null;
  readonly featureDetailSlotsV1?: FeatureDetailSlotsV1 | null;
}): ConversationFocusWire | undefined {
  if (input.actionId === "EDIT_FEATURES" && input.featureDetailSlotsV1?.focusFeatureId) {
    const slot = input.featureDetailSlotsV1.slots.find((s) => s.id === input.featureDetailSlotsV1!.focusFeatureId);
    return slot ? { type: "feature", id: slot.id, label: slot.title } : undefined;
  }
  if (input.actionId === "OPEN_CANVAS") return { type: "flow", id: "service-flow", label: "서비스 흐름" };
  if (input.actionId === "OPEN_ARTIFACT_HUB") return { type: "none", id: "artifact-hub", label: "Artifact Hub" };
  return input.focus ?? undefined;
}
