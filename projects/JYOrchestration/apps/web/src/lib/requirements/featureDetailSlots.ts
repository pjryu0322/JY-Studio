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
  | "screen_define_enter";

export type FeatureDetailLastMutationV1 = Readonly<{
  readonly featureId?: string;
  readonly linkedStepId?: string;
  readonly featureStatus?: FeatureDetailSlotStatus;
  readonly featureAction: FeatureDetailMutationAction;
  readonly mutationSource: string;
  readonly at: string;
}>;

export type FeatureDetailSlotsV1 = Readonly<{
  readonly version: 1;
  readonly slots: readonly FeatureDetailSlot[];
  readonly updatedAt: string;
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
      };
    }
  }
  return { version: 1, slots, updatedAt, ...(lastMutation ? { lastMutation } : {}) };
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
  const canEnterScreenDefine =
    hasConfirmedFeature && featureCoverage >= FEATURE_DETAIL_COVERAGE_THRESHOLD;
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
  const focus =
    artifact.slots.find((s) => s.status === "candidate" || s.status === "partial") ?? artifact.slots[0];

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

export function buildScreenDefineBlockedMessage(metrics: FeatureDetailProjectionMetrics): string {
  const pct = Math.round(metrics.featureCoverage * 100);
  const need = Math.round(FEATURE_DETAIL_COVERAGE_THRESHOLD * 100);
  if (!metrics.hasConfirmedFeature) {
    return [
      "아직 **확정된 기능**이 없습니다.",
      "",
      "화면 정의를 시작하려면 최소 1개 기능을 확정해 주세요.",
      "「기능 수정」으로 입력·처리·출력·예외를 정리한 뒤 확정할 수 있습니다.",
    ].join("\n");
  }
  return [
    `기능 확정 진행률이 **${pct}%**입니다 (화면 정의 진입 권장: **${need}%** 이상).`,
    "",
    "추가 기능을 확정한 뒤 「화면 정의」를 다시 선택해 주세요.",
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
    if (action.id === "DEFINE_SCREEN" && !input.metrics.canEnterScreenDefine) return false;
    if (
      action.id === "DEFINE_API" &&
      input.stage === "FEATURE_DETAIL" &&
      input.activePhase !== "screen_define" &&
      !input.metrics.canEnterScreenDefine
    ) {
      return false;
    }
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
