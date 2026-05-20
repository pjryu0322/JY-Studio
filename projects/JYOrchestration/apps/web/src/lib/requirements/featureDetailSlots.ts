/**
 * FEATURE_DETAIL structured orchestration state — single source of truth (not chat parsing).
 */

import { hydrateServiceFlowStepsFromAlternativePayload } from "@/lib/requirements/serviceFlowAlternativeProposalPayload";
import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import type { OrchestrationStage } from "@/lib/requirements/requirementsOrchestrationRegistry";
import type { QuickAction, QuickActionId } from "@/lib/requirements/requirementsQuickActionRegistry";

export const FEATURE_DETAIL_COVERAGE_THRESHOLD = 0.7;

export type FeatureDetailSlotStatus = "candidate" | "partial" | "confirmed" | "obsolete";

export type FeatureDetailSlot = Readonly<{
  readonly id: string;
  readonly linkedStepId: string;
  readonly title: string;
  readonly description?: string;
  readonly inputData?: readonly string[];
  readonly processRules?: readonly string[];
  readonly outputData?: readonly string[];
  readonly exceptionCases?: readonly string[];
  readonly relatedActors?: readonly string[];
  readonly status: FeatureDetailSlotStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}>;

export type FeatureDetailMutationAction =
  | "bootstrap"
  | "confirm"
  | "partial_edit"
  | "obsolete"
  | "screen_define_enter"
  | "api_define_enter";

export type FeatureDetailLastMutationV1 = Readonly<{
  readonly featureId?: string;
  readonly linkedStepId?: string;
  readonly featureStatus?: FeatureDetailSlotStatus;
  readonly previousStatus?: FeatureDetailSlotStatus;
  readonly nextStatus?: FeatureDetailSlotStatus;
  readonly featureAction: FeatureDetailMutationAction;
  readonly mutationSource: string;
  readonly at: string;
}>;

export type FeatureDetailSlotEditDraft = Readonly<{
  readonly title: string;
  readonly description: string;
  readonly inputData: string;
  readonly processRules: string;
  readonly outputData: string;
  readonly exceptionCases: string;
  readonly relatedActors: string;
  readonly linkedStepId: string;
}>;

export type FeatureDetailSlotsV1 = Readonly<{
  readonly version: 1;
  readonly slots: readonly FeatureDetailSlot[];
  readonly updatedAt: string;
  readonly focusFeatureId?: string;
  readonly lastMutation?: FeatureDetailLastMutationV1;
}>;

export type FeatureDetailProjectionMetrics = Readonly<{
  readonly featureCount: number;
  readonly confirmedFeatureCount: number;
  readonly candidateFeatureCount: number;
  readonly partialFeatureCount: number;
  readonly featureCoverage: number;
  readonly hasCandidateFeature: boolean;
  readonly hasConfirmedFeature: boolean;
  readonly canEnterScreenDefine: boolean;
}>;

const STATUS_SET = new Set<FeatureDetailSlotStatus>(["candidate", "partial", "confirmed", "obsolete"]);

function parseStringArray(raw: unknown, max = 24): readonly string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max);
  return out.length ? out : undefined;
}

function parseSlot(raw: unknown): FeatureDetailSlot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const linkedStepId = String(o.linkedStepId ?? "").trim();
  const title = String(o.title ?? "").trim();
  const status = String(o.status ?? "").trim() as FeatureDetailSlotStatus;
  const createdAt = String(o.createdAt ?? "").trim();
  const updatedAt = String(o.updatedAt ?? "").trim();
  if (!id || !linkedStepId || !title || !STATUS_SET.has(status) || !createdAt || !updatedAt) return null;
  return {
    id,
    linkedStepId,
    title,
    ...(typeof o.description === "string" && o.description.trim() ? { description: o.description.trim().slice(0, 4000) } : {}),
    ...(parseStringArray(o.inputData) ? { inputData: parseStringArray(o.inputData) } : {}),
    ...(parseStringArray(o.processRules) ? { processRules: parseStringArray(o.processRules) } : {}),
    ...(parseStringArray(o.outputData) ? { outputData: parseStringArray(o.outputData) } : {}),
    ...(parseStringArray(o.exceptionCases) ? { exceptionCases: parseStringArray(o.exceptionCases) } : {}),
    ...(parseStringArray(o.relatedActors) ? { relatedActors: parseStringArray(o.relatedActors) } : {}),
    status,
    createdAt,
    updatedAt,
  };
}

export function parseFeatureDetailSlotsV1(raw: unknown): FeatureDetailSlotsV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (Number(o.version) !== 1) return null;
  const updatedAt = String(o.updatedAt ?? "").trim();
  if (!updatedAt) return null;
  const slots = Array.isArray(o.slots)
    ? o.slots.map(parseSlot).filter((x): x is FeatureDetailSlot => Boolean(x)).slice(0, 120)
    : [];
  let lastMutation: FeatureDetailLastMutationV1 | undefined;
  if (o.lastMutation && typeof o.lastMutation === "object") {
    const m = o.lastMutation as Record<string, unknown>;
    const featureAction = String(m.featureAction ?? "").trim() as FeatureDetailMutationAction;
    const mutationSource = String(m.mutationSource ?? "").trim();
    const at = String(m.at ?? "").trim();
    if (mutationSource && at) {
      lastMutation = {
        featureAction,
        mutationSource,
        at,
        ...(typeof m.featureId === "string" && m.featureId.trim() ? { featureId: m.featureId.trim() } : {}),
        ...(typeof m.linkedStepId === "string" && m.linkedStepId.trim()
          ? { linkedStepId: m.linkedStepId.trim() }
          : {}),
        ...(typeof m.featureStatus === "string" && STATUS_SET.has(m.featureStatus as FeatureDetailSlotStatus)
          ? { featureStatus: m.featureStatus as FeatureDetailSlotStatus }
          : {}),
        ...(typeof m.previousStatus === "string" && STATUS_SET.has(m.previousStatus as FeatureDetailSlotStatus)
          ? { previousStatus: m.previousStatus as FeatureDetailSlotStatus }
          : {}),
        ...(typeof m.nextStatus === "string" && STATUS_SET.has(m.nextStatus as FeatureDetailSlotStatus)
          ? { nextStatus: m.nextStatus as FeatureDetailSlotStatus }
          : {}),
      };
    }
  }
  const focusFeatureId =
    typeof o.focusFeatureId === "string" && o.focusFeatureId.trim() ? o.focusFeatureId.trim() : undefined;
  return {
    version: 1,
    slots,
    updatedAt,
    ...(focusFeatureId ? { focusFeatureId } : {}),
    ...(lastMutation ? { lastMutation } : {}),
  };
}

export function activeFeatureDetailSlots(artifact: FeatureDetailSlotsV1 | null | undefined): readonly FeatureDetailSlot[] {
  return (artifact?.slots ?? []).filter((s) => s.status !== "obsolete");
}

export function resolveFocusFeatureSlot(
  artifact: FeatureDetailSlotsV1,
  preferredId?: string | null,
): FeatureDetailSlot | undefined {
  const active = activeFeatureDetailSlots(artifact);
  if (!active.length) return undefined;
  const pref = String(preferredId ?? artifact.focusFeatureId ?? "").trim();
  if (pref) {
    const hit = active.find((s) => s.id === pref);
    if (hit) return hit;
  }
  return active.find((s) => s.status === "candidate" || s.status === "partial") ?? active[0];
}

export function withFeatureDetailFocus(
  artifact: FeatureDetailSlotsV1,
  featureId: string | null | undefined,
): FeatureDetailSlotsV1 {
  const id = String(featureId ?? "").trim();
  if (!id) return artifact;
  return { ...artifact, focusFeatureId: id };
}

function splitMultilineField(raw: string, max = 24): readonly string[] | undefined {
  const out = String(raw ?? "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
  return out.length ? out : undefined;
}

function joinMultilineField(items: readonly string[] | undefined): string {
  return (items ?? []).join("\n");
}

function splitRelatedActorsField(raw: string, max = 16): readonly string[] | undefined {
  const out = String(raw ?? "")
    .split(/[,，\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
  return out.length ? [...new Set(out)] : undefined;
}

function joinRelatedActorsField(items: readonly string[] | undefined): string {
  return (items ?? []).join(", ");
}

export function countFeatureDetailStructuredSections(
  slot: Pick<
    FeatureDetailSlot,
    "inputData" | "processRules" | "outputData" | "exceptionCases"
  >,
): number {
  let n = 0;
  if (slot.inputData?.length) n += 1;
  if (slot.processRules?.length) n += 1;
  if (slot.outputData?.length) n += 1;
  if (slot.exceptionCases?.length) n += 1;
  return n;
}

export function canConfirmFeatureDetailSlot(
  slot: Pick<
    FeatureDetailSlot,
    "inputData" | "processRules" | "outputData" | "exceptionCases"
  >,
): boolean {
  return countFeatureDetailStructuredSections(slot) >= 2;
}

export function featureDetailSlotToEditDraft(slot: FeatureDetailSlot): FeatureDetailSlotEditDraft {
  return {
    title: slot.title,
    description: String(slot.description ?? ""),
    inputData: joinMultilineField(slot.inputData),
    processRules: joinMultilineField(slot.processRules),
    outputData: joinMultilineField(slot.outputData),
    exceptionCases: joinMultilineField(slot.exceptionCases),
    relatedActors: joinRelatedActorsField(slot.relatedActors),
    linkedStepId: slot.linkedStepId,
  };
}

export function applyFeatureDetailEditDraft(
  slot: FeatureDetailSlot,
  draft: FeatureDetailSlotEditDraft,
  nowIso: string,
): FeatureDetailSlot {
  const title = String(draft.title ?? "").trim().slice(0, 120) || slot.title;
  const description = String(draft.description ?? "").trim().slice(0, 4000) || undefined;
  const linkedStepId = String(draft.linkedStepId ?? "").trim() || slot.linkedStepId;
  return {
    ...slot,
    title,
    linkedStepId,
    ...(description ? { description } : {}),
    inputData: splitMultilineField(draft.inputData),
    processRules: splitMultilineField(draft.processRules),
    outputData: splitMultilineField(draft.outputData),
    exceptionCases: splitMultilineField(draft.exceptionCases),
    relatedActors: splitRelatedActorsField(draft.relatedActors),
    updatedAt: nowIso,
  };
}

function mapFeatureDetailSlot(
  artifact: FeatureDetailSlotsV1,
  featureId: string,
  map: (slot: FeatureDetailSlot) => FeatureDetailSlot,
): { readonly artifact: FeatureDetailSlotsV1; readonly previous: FeatureDetailSlot | null; readonly next: FeatureDetailSlot | null } {
  let previous: FeatureDetailSlot | null = null;
  let next: FeatureDetailSlot | null = null;
  const slots = artifact.slots.map((slot) => {
    if (slot.id !== featureId) return slot;
    previous = slot;
    next = map(slot);
    return next;
  });
  if (!previous || !next) {
    return { artifact, previous: null, next: null };
  }
  const at = next.updatedAt;
  return {
    artifact: { ...artifact, slots, updatedAt: at },
    previous,
    next,
  };
}

function commitFeatureDetailSlotMutation(input: {
  readonly artifact: FeatureDetailSlotsV1;
  readonly previous: FeatureDetailSlot | null;
  readonly next: FeatureDetailSlot | null;
  readonly featureAction: FeatureDetailMutationAction;
  readonly mutationSource: string;
  readonly at: string;
}): FeatureDetailSlotsV1 {
  const { artifact, previous, next, featureAction, mutationSource, at } = input;
  if (!previous || !next) return artifact;
  return recordFeatureDetailMutation(artifact, {
    featureId: next.id,
    linkedStepId: next.linkedStepId,
    featureStatus: next.status,
    previousStatus: previous.status,
    nextStatus: next.status,
    featureAction,
    mutationSource,
    at,
  });
}

export function updateFeatureDetailSlot(input: {
  readonly artifact: FeatureDetailSlotsV1;
  readonly featureId: string;
  readonly draft: FeatureDetailSlotEditDraft;
  readonly mutationSource?: string;
  readonly nowIso?: string;
}): FeatureDetailSlotsV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const { artifact, previous, next } = mapFeatureDetailSlot(input.artifact, input.featureId, (slot) => {
    const edited = applyFeatureDetailEditDraft(slot, input.draft, now);
    const sections = countFeatureDetailStructuredSections(edited);
    const status: FeatureDetailSlotStatus =
      slot.status === "obsolete" ? "obsolete"
      : sections >= 2 ? "confirmed"
      : sections >= 1 ? "partial"
      : slot.status === "confirmed" ? "partial"
      : "candidate";
    return { ...edited, status };
  });
  return commitFeatureDetailSlotMutation({
    artifact,
    previous,
    next,
    featureAction: "partial_edit",
    mutationSource: input.mutationSource ?? "updateFeatureDetailSlot",
    at: now,
  });
}

export function markFeatureDetailSlotPartial(input: {
  readonly artifact: FeatureDetailSlotsV1;
  readonly featureId: string;
  readonly draft: FeatureDetailSlotEditDraft;
  readonly mutationSource?: string;
  readonly nowIso?: string;
}): FeatureDetailSlotsV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const { artifact, previous, next } = mapFeatureDetailSlot(input.artifact, input.featureId, (slot) => {
    const edited = applyFeatureDetailEditDraft(slot, input.draft, now);
    return { ...edited, status: "partial" as const };
  });
  return commitFeatureDetailSlotMutation({
    artifact,
    previous,
    next,
    featureAction: "partial_edit",
    mutationSource: input.mutationSource ?? "markFeatureDetailSlotPartial",
    at: now,
  });
}

export function confirmFeatureDetailSlot(input: {
  readonly artifact: FeatureDetailSlotsV1;
  readonly featureId: string;
  readonly draft: FeatureDetailSlotEditDraft;
  readonly mutationSource?: string;
  readonly nowIso?: string;
}): { readonly artifact: FeatureDetailSlotsV1; readonly error?: string } {
  const now = input.nowIso ?? new Date().toISOString();
  const edited = applyFeatureDetailEditDraft(
    input.artifact.slots.find((s) => s.id === input.featureId) ?? {
      id: input.featureId,
      linkedStepId: input.draft.linkedStepId,
      title: input.draft.title,
      status: "candidate",
      createdAt: now,
      updatedAt: now,
    },
    input.draft,
    now,
  );
  if (!canConfirmFeatureDetailSlot(edited)) {
    return {
      artifact: input.artifact,
      error: "입력·처리·출력·예외 중 2개 이상을 작성해야 확정할 수 있습니다.",
    };
  }
  const { artifact, previous, next } = mapFeatureDetailSlot(input.artifact, input.featureId, () => ({
    ...edited,
    status: "confirmed" as const,
  }));
  if (!previous || !next) return { artifact: input.artifact, error: "기능을 찾을 수 없습니다." };
  return {
    artifact: commitFeatureDetailSlotMutation({
      artifact,
      previous,
      next,
      featureAction: "confirm",
      mutationSource: input.mutationSource ?? "confirmFeatureDetailSlot",
      at: now,
    }),
  };
}

export type FeatureDetailSlotMutationMode = "partial" | "confirm" | "obsolete";

export function applyFeatureDetailSlotMutation(input: {
  readonly artifact: FeatureDetailSlotsV1;
  readonly featureId: string;
  readonly mode: FeatureDetailSlotMutationMode;
  readonly draft?: FeatureDetailSlotEditDraft;
  readonly mutationSource: string;
  readonly nowIso?: string;
}): { readonly artifact: FeatureDetailSlotsV1; readonly error?: string } {
  if (input.mode === "obsolete") {
    return {
      artifact: obsoleteFeatureDetailSlot({
        artifact: input.artifact,
        featureId: input.featureId,
        mutationSource: input.mutationSource,
        nowIso: input.nowIso,
      }),
    };
  }
  const slot = input.artifact.slots.find((s) => s.id === input.featureId);
  if (!slot) return { artifact: input.artifact, error: "기능을 찾을 수 없습니다." };
  const draft = input.draft ?? featureDetailSlotToEditDraft(slot);
  if (input.mode === "partial") {
    return {
      artifact: markFeatureDetailSlotPartial({
        artifact: input.artifact,
        featureId: input.featureId,
        draft,
        mutationSource: input.mutationSource,
        nowIso: input.nowIso,
      }),
    };
  }
  return confirmFeatureDetailSlot({
    artifact: input.artifact,
    featureId: input.featureId,
    draft,
    mutationSource: input.mutationSource,
    nowIso: input.nowIso,
  });
}

export function obsoleteFeatureDetailSlot(input: {
  readonly artifact: FeatureDetailSlotsV1;
  readonly featureId: string;
  readonly mutationSource?: string;
  readonly nowIso?: string;
}): FeatureDetailSlotsV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const { artifact, previous, next } = mapFeatureDetailSlot(input.artifact, input.featureId, (slot) => ({
    ...slot,
    status: "obsolete" as const,
    updatedAt: now,
  }));
  return commitFeatureDetailSlotMutation({
    artifact,
    previous,
    next,
    featureAction: "obsolete",
    mutationSource: input.mutationSource ?? "obsoleteFeatureDetailSlot",
    at: now,
  });
}

/** linkedStepId 변경·obsolete 시 feature projection만 재계산 (flow slot invalidation 없음). */
export function shouldRecomputeFeatureDetailProjection(
  previous: FeatureDetailSlot | null,
  next: FeatureDetailSlot | null,
): boolean {
  if (!previous || !next) return false;
  if (previous.linkedStepId !== next.linkedStepId) return true;
  if (previous.status !== "obsolete" && next.status === "obsolete") return true;
  return false;
}

export function deriveFeatureTitleFromStepTitle(stepTitle: string): string {
  let t = String(stepTitle ?? "").trim();
  if (!t) return "기능";
  t = t
    .replace(/^(사용자|관리자|시스템|담당자|운영자)가?\s*/i, "")
    .replace(/(합니다|한다|됩니다|된다)\.?$/i, "")
    .trim();
  if (t.length > 48) t = t.slice(0, 48);
  return t || stepTitle.trim();
}

export function seedFeatureDetailSlotsFromServiceFlow(
  flow: RequirementsServiceFlowV1,
  nowIso?: string,
): FeatureDetailSlotsV1 {
  const now = nowIso ?? new Date().toISOString();
  const hydrated = hydrateServiceFlowStepsFromAlternativePayload(flow);
  const actors = hydrated.actors ?? [];
  const actorLabel = (id: string): string => {
    const a = actors.find((row) => row.id === id);
    return (a?.name ?? id).trim() || id;
  };

  const slots: FeatureDetailSlot[] = [...(hydrated.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const title = deriveFeatureTitleFromStepTitle(String(step.title ?? "").trim() || `단계 ${step.order}`);
      const related = [
        step.primaryActorId,
        ...(step.secondaryActorIds ?? []),
      ]
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
        .map(actorLabel);
      return {
        id: `fd-${step.id}`,
        linkedStepId: step.id,
        title,
        description: String(step.purpose ?? "").trim().slice(0, 1200) || undefined,
        relatedActors: related.length ? [...new Set(related)] : undefined,
        status: "candidate" as const,
        createdAt: now,
        updatedAt: now,
      };
    });

  return {
    version: 1,
    slots,
    updatedAt: now,
    ...(slots[0] ? { focusFeatureId: slots[0].id } : {}),
    lastMutation: {
      featureAction: "bootstrap",
      mutationSource: "FEATURE_DETAIL_START",
      at: now,
      featureStatus: "candidate",
    },
  };
}

export function projectFeatureDetailMetrics(
  artifact: FeatureDetailSlotsV1 | null | undefined,
): FeatureDetailProjectionMetrics {
  const active = (artifact?.slots ?? []).filter((s) => s.status !== "obsolete");
  const featureCount = active.length;
  const confirmedFeatureCount = active.filter((s) => s.status === "confirmed").length;
  const candidateFeatureCount = active.filter((s) => s.status === "candidate").length;
  const partialFeatureCount = active.filter((s) => s.status === "partial").length;
  const featureCoverage = featureCount > 0 ? confirmedFeatureCount / featureCount : 0;
  const hasCandidateFeature = candidateFeatureCount + partialFeatureCount + confirmedFeatureCount > 0;
  const hasConfirmedFeature = confirmedFeatureCount > 0;
  const canEnterScreenDefine = hasConfirmedFeature;
  return {
    featureCount,
    confirmedFeatureCount,
    candidateFeatureCount,
    partialFeatureCount,
    featureCoverage,
    hasCandidateFeature,
    hasConfirmedFeature,
    canEnterScreenDefine,
  };
}

export function buildFeatureDetailBootstrapMessage(
  flow: RequirementsServiceFlowV1,
  artifact: FeatureDetailSlotsV1,
): string {
  const metrics = projectFeatureDetailMetrics(artifact);
  const hydrated = hydrateServiceFlowStepsFromAlternativePayload(flow);
  const steps = [...(hydrated.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.title.trim())
    .filter(Boolean);
  const focus = resolveFocusFeatureSlot(artifact);

  const lines = [
    "현재 승인된 서비스 흐름을 기준으로 **세부 기능 정의** 단계로 이동했습니다.",
    "",
    `기능 후보 **${metrics.featureCount}개**가 생성되었습니다 (확정 ${metrics.confirmedFeatureCount}개 · 진행률 ${Math.round(metrics.featureCoverage * 100)}%).`,
    "",
    "확인된 흐름:",
    ...steps.map((t, i) => `${i + 1}. ${t}`),
    "",
    metrics.hasConfirmedFeature
      ? "확정된 기능을 바탕으로 화면·API 정의를 이어갈 수 있습니다."
      : "우선 각 기능의 **입력 데이터·처리 방식·출력·예외 상황**을 확정해 주세요.",
  ];

  if (focus) {
    lines.push(
      "",
      `다음 focus: **${focus.title}** (연결 단계: \`${focus.linkedStepId}\`)`,
      "- 입력 데이터",
      "- 처리 방식",
      "- 출력 결과",
      "- 예외 상황",
    );
  }

  return lines.join("\n").trim();
}

export function buildFeatureDetailDefineBlockedMessage(
  metrics: FeatureDetailProjectionMetrics,
  kind: "screen" | "api",
): string {
  if (!metrics.hasConfirmedFeature) {
    const target = kind === "api" ? "API 정의" : "화면 정의";
    return [
      "아직 **확정된 기능**이 없습니다.",
      "",
      `${target}를 시작하려면 최소 1개 기능을 확정해 주세요.`,
      "「기능 수정」으로 입력·처리·출력·예외를 정리한 뒤 확정할 수 있습니다.",
    ].join("\n");
  }
  return "";
}

/** @deprecated use buildFeatureDetailDefineBlockedMessage */
export function buildScreenDefineBlockedMessage(metrics: FeatureDetailProjectionMetrics): string {
  return buildFeatureDetailDefineBlockedMessage(metrics, "screen");
}

export function buildApiDefineLowCoverageWarning(metrics: FeatureDetailProjectionMetrics): string | null {
  if (!metrics.hasConfirmedFeature) return null;
  const pct = Math.round(metrics.featureCoverage * 100);
  const need = Math.round(FEATURE_DETAIL_COVERAGE_THRESHOLD * 100);
  if (pct >= need) return null;
  return [
    `전체 기능 확정률이 **${pct}%**로 낮습니다.`,
    "일부 확정 기능 기준으로 API 정의를 시작합니다. 나머지 기능은 이후에 확정해 주세요.",
  ].join("\n");
}

export function buildScreenDefineLowCoverageWarning(metrics: FeatureDetailProjectionMetrics): string | null {
  if (!metrics.hasConfirmedFeature) return null;
  const pct = Math.round(metrics.featureCoverage * 100);
  const need = Math.round(FEATURE_DETAIL_COVERAGE_THRESHOLD * 100);
  if (pct >= need) return null;
  return [
    `전체 기능 확정률이 **${pct}%**로 낮습니다.`,
    "일부 기능 기준으로 화면 정의를 시작합니다. 나머지 기능은 이후에 확정해 주세요.",
  ].join("\n");
}

export function filterFeatureDetailQuickActions(input: {
  readonly actions: readonly QuickAction[];
  readonly metrics: FeatureDetailProjectionMetrics;
  readonly stage: OrchestrationStage;
  readonly activePhase?: string | null;
}): readonly QuickAction[] {
  const screenApiIds = new Set<QuickActionId>(["DEFINE_SCREEN", "DEFINE_API"]);
  return input.actions.filter((action) => {
    if (!input.metrics.hasCandidateFeature && screenApiIds.has(action.id)) return false;
    if (!input.metrics.hasConfirmedFeature && screenApiIds.has(action.id)) return false;
    return true;
  });
}

export function mergeFeatureDetailReadinessPercent(input: {
  readonly orchestrationPercent: number;
  readonly stage: OrchestrationStage;
  readonly metrics: FeatureDetailProjectionMetrics;
}): number {
  if (input.stage !== "FEATURE_DETAIL" && input.stage !== "SCREEN_DEFINE") {
    return input.orchestrationPercent;
  }
  const featurePct = Math.round(input.metrics.featureCoverage * 100);
  return Math.round(input.orchestrationPercent * 0.35 + featurePct * 0.65);
}

export function recordFeatureDetailMutation(
  artifact: FeatureDetailSlotsV1,
  mutation: Omit<FeatureDetailLastMutationV1, "at"> & { readonly at?: string },
): FeatureDetailSlotsV1 {
  const at = mutation.at ?? new Date().toISOString();
  return {
    ...artifact,
    updatedAt: at,
    lastMutation: { ...mutation, at },
  };
}
