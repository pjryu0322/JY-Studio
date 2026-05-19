/**
 * Alternative proposal visualization payload — chat summary ≠ canvas source of truth.
 */

import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";
import { fingerprintHashFromFlow } from "@/lib/requirements/serviceFlowProposalVariant";

export type AlternativeProposalActorWire = Readonly<{
  id: string;
  name: string;
  kind: "human" | "system";
}>;

export type AlternativeProposalStepWire = Readonly<{
  id: string;
  title: string;
  order: number;
}>;

export type AlternativeProposalComparisonWire = Readonly<{
  addedActors: readonly string[];
  removedActors: readonly string[];
  addedSteps: readonly string[];
  removedSteps: readonly string[];
  changedSteps: readonly string[];
  baselineActors: readonly string[];
  baselineSteps: readonly string[];
}>;

export type AlternativeProposalPayloadWire = Readonly<{
  proposalId: string;
  proposalVariantMode: "ALTERNATIVE";
  baselineFingerprint: string;
  proposalFingerprint: string;
  summary: string;
  changeHighlights: readonly string[];
  directionLabel?: string;
  actors: readonly AlternativeProposalActorWire[];
  steps: readonly AlternativeProposalStepWire[];
  comparison: AlternativeProposalComparisonWire;
  rationale?: string;
  /** 기존안 유지 시 복원용 스냅샷 */
  baselineFlow: RequirementsServiceFlowV1;
}>;

export const ALTERNATIVE_CANVAS_QUICK_REPLIES = [
  "대안 상세 보기",
  "이 대안 적용",
  "다른 대안 다시 생성",
] as const;

function norm(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function actorNames(flow: RequirementsServiceFlowV1): string[] {
  return (flow.actors ?? []).map((a) => a.name.trim()).filter(Boolean);
}

function stepTitles(flow: RequirementsServiceFlowV1): string[] {
  return [...(flow.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.title.trim())
    .filter(Boolean);
}

function toActorWire(a: RequirementsServiceFlowActorV1): AlternativeProposalActorWire {
  return { id: a.id, name: a.name, kind: a.kind };
}

function toStepWire(s: RequirementsServiceFlowStepV1): AlternativeProposalStepWire {
  return { id: s.id, title: s.title, order: s.order };
}

export function computeAlternativeProposalComparison(
  baselineFlow: RequirementsServiceFlowV1,
  alternativeFlow: RequirementsServiceFlowV1,
): AlternativeProposalComparisonWire {
  const baseActors = actorNames(baselineFlow);
  const altActors = actorNames(alternativeFlow);
  const baseSteps = stepTitles(baselineFlow);
  const altSteps = stepTitles(alternativeFlow);

  const baseActorSet = new Set(baseActors.map(norm));
  const altActorSet = new Set(altActors.map(norm));
  const baseStepSet = new Set(baseSteps.map(norm));
  const altStepSet = new Set(altSteps.map(norm));

  const addedActors = altActors.filter((a) => !baseActorSet.has(norm(a)));
  const removedActors = baseActors.filter((a) => !altActorSet.has(norm(a)));
  const addedSteps = altSteps.filter((s) => !baseStepSet.has(norm(s)));
  const removedSteps = baseSteps.filter((s) => !altStepSet.has(norm(s)));

  const changedSteps: string[] = [];
  const overlap = Math.min(baseSteps.length, altSteps.length);
  for (let i = 0; i < overlap; i += 1) {
    if (norm(baseSteps[i]) !== norm(altSteps[i]) && !addedSteps.includes(altSteps[i])) {
      changedSteps.push(`${baseSteps[i]} → ${altSteps[i]}`);
    }
  }

  return {
    addedActors,
    removedActors,
    addedSteps,
    removedSteps,
    changedSteps: changedSteps.slice(0, 8),
    baselineActors: baseActors,
    baselineSteps: baseSteps,
  };
}

export function inferAlternativeDirectionLabel(
  comparison: AlternativeProposalComparisonWire,
): string | undefined {
  const blob = [
    ...comparison.addedSteps,
    ...comparison.addedActors,
    ...comparison.changedSteps,
  ].join(" ");
  if (/검토|승인|확정|협업/.test(blob)) return "협업·검토 강화형";
  if (/실시간|스트림|동기/.test(blob)) return "실시간 처리형";
  if (/관리자|운영|검수/.test(blob)) return "관리자 검수형";
  if (/자동|배치|비동기/.test(blob)) return "자동화·비동기 처리형";
  if (comparison.addedSteps.length || comparison.addedActors.length) return "운영 방식 변경형";
  return undefined;
}

export function buildAlternativeChangeHighlights(
  comparison: AlternativeProposalComparisonWire,
): string[] {
  const out: string[] = [];
  for (const a of comparison.addedActors.slice(0, 2)) out.push(`${a} actor 추가`);
  for (const s of comparison.addedSteps.slice(0, 3)) out.push(`'${s}' 단계 추가`);
  for (const c of comparison.changedSteps.slice(0, 2)) out.push(`단계 변경: ${c}`);
  if (comparison.removedSteps.length) out.push(`단계 ${comparison.removedSteps.length}개 단순화`);
  if (out.length < 2) {
    if (comparison.addedActors.length || comparison.addedSteps.length) {
      out.push("액터·흐름 구성을 재배치했습니다");
    } else {
      out.push("협업·처리 관점을 조정했습니다");
    }
  }
  return out.slice(0, 5);
}

function extractRationaleFromLlmMessage(llmMessage: string): string | undefined {
  const body = String(llmMessage ?? "").trim();
  if (!body) return undefined;
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^예상\s*(서비스\s*)?흐름|^예상\s*액터|^\d+\./.test(l));
  const candidate =
    lines.find((l) => /대안|방향|강화|중심|검토|협업/.test(l) && l.length >= 12 && l.length <= 220) ??
    lines[0];
  if (!candidate) return undefined;
  return candidate.slice(0, 220);
}

export function buildAlternativeProposalPayload(input: {
  readonly baselineFlow: RequirementsServiceFlowV1;
  readonly alternativeFlow: RequirementsServiceFlowV1;
  readonly llmAssistantMessage?: string;
  readonly proposalId?: string;
  readonly nowIso?: string;
}): AlternativeProposalPayloadWire {
  const comparison = computeAlternativeProposalComparison(input.baselineFlow, input.alternativeFlow);
  const changeHighlights = buildAlternativeChangeHighlights(comparison);
  const directionLabel = inferAlternativeDirectionLabel(comparison);
  const rationale = extractRationaleFromLlmMessage(input.llmAssistantMessage ?? "");

  const summaryParts = [
    "기존 초안과 다른 방향의 대안을 생성했습니다.",
    directionLabel ? `(${directionLabel})` : "",
  ].filter(Boolean);

  return {
    proposalId: input.proposalId ?? `alt-${Date.now()}`,
    proposalVariantMode: "ALTERNATIVE",
    baselineFingerprint: fingerprintHashFromFlow(input.baselineFlow),
    proposalFingerprint: fingerprintHashFromFlow(input.alternativeFlow),
    summary: summaryParts.join(" "),
    changeHighlights,
    ...(directionLabel ? { directionLabel } : {}),
    actors: (input.alternativeFlow.actors ?? []).map(toActorWire),
    steps: [...(input.alternativeFlow.steps ?? [])]
      .sort((a, b) => a.order - b.order)
      .map(toStepWire),
    comparison,
    ...(rationale ? { rationale } : {}),
    baselineFlow: input.baselineFlow,
  };
}

export function buildAlternativeCompactAssistantMessage(payload: AlternativeProposalPayloadWire): string {
  const lines: string[] = [payload.summary, "", "이번 대안은:"];
  for (const h of payload.changeHighlights.slice(0, 3)) {
    lines.push(`- ${h}`);
  }
  if (payload.rationale) {
    lines.push("", payload.rationale);
  }
  return lines.join("\n").trim();
}

export function parseAlternativeProposalPayloadWire(raw: unknown): AlternativeProposalPayloadWire | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.proposalVariantMode !== "ALTERNATIVE") return null;
  const proposalId = String(o.proposalId ?? "").trim();
  if (!proposalId) return null;

  const comparisonRaw = o.comparison;
  if (!comparisonRaw || typeof comparisonRaw !== "object") return null;
  const c = comparisonRaw as Record<string, unknown>;
  const list = (v: unknown, max: number) =>
    Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max) : [];

  const actors: AlternativeProposalActorWire[] = [];
  if (Array.isArray(o.actors)) {
    for (const row of o.actors) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "").trim();
      const name = String(r.name ?? "").trim();
      const kind = r.kind === "system" ? "system" : r.kind === "human" ? "human" : null;
      if (id && name && kind) actors.push({ id, name, kind });
    }
  }

  const steps: AlternativeProposalStepWire[] = [];
  if (Array.isArray(o.steps)) {
    for (const row of o.steps) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "").trim();
      const title = String(r.title ?? "").trim();
      const order = Number(r.order);
      if (id && title && Number.isFinite(order)) steps.push({ id, title, order: Math.floor(order) });
    }
  }

  const baselineFlow = o.baselineFlow;
  if (!baselineFlow || typeof baselineFlow !== "object") return null;

  return {
    proposalId: proposalId.slice(0, 64),
    proposalVariantMode: "ALTERNATIVE",
    baselineFingerprint: String(o.baselineFingerprint ?? "").trim().slice(0, 80),
    proposalFingerprint: String(o.proposalFingerprint ?? "").trim().slice(0, 80),
    summary: String(o.summary ?? "").trim().slice(0, 400),
    changeHighlights: list(o.changeHighlights, 8),
    ...(typeof o.directionLabel === "string" && o.directionLabel.trim()
      ? { directionLabel: o.directionLabel.trim().slice(0, 40) }
      : {}),
    actors,
    steps,
    comparison: {
      addedActors: list(c.addedActors, 12),
      removedActors: list(c.removedActors, 12),
      addedSteps: list(c.addedSteps, 12),
      removedSteps: list(c.removedSteps, 12),
      changedSteps: list(c.changedSteps, 12),
      baselineActors: list(c.baselineActors, 12),
      baselineSteps: list(c.baselineSteps, 16),
    },
    ...(typeof o.rationale === "string" && o.rationale.trim()
      ? { rationale: o.rationale.trim().slice(0, 280) }
      : {}),
    baselineFlow: baselineFlow as RequirementsServiceFlowV1,
  };
}
