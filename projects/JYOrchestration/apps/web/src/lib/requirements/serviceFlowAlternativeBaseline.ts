/**
 * Alternative proposal baseline recovery — currentFlow가 비어 있어도 proposal 텍스트에서 기준 확보.
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  extractActorsFromProposalText,
  extractHandoffSummaryBody,
  extractWorkflowFromProposalText,
} from "@/lib/requirements/crossStageProposalDedupe";
import { hasProposalFirstStructure } from "@/lib/requirements/requirementsBootstrapInterviewQuality";

export type AlternativeBaselineSource =
  | "currentFlow"
  | "acceptedProposalSnapshot"
  | "lastVisibleProposal"
  | "bootstrapProposalDraft"
  | "priorScreenHandoff";

export type AlternativeBaseline = Readonly<{
  source: AlternativeBaselineSource;
  flow: RequirementsServiceFlowV1;
  referenceText: string;
}>;

function inferActorKind(name: string): "human" | "system" {
  return /시스템|엔진|배치|API|서버|AI|봇|자동/.test(String(name ?? "")) ? "system" : "human";
}

export function buildRequirementsServiceFlowFromProposalText(
  text: string,
  nowIso?: string,
): RequirementsServiceFlowV1 | null {
  const now = nowIso ?? new Date().toISOString();
  const actors = extractActorsFromProposalText(text);
  const workflow = extractWorkflowFromProposalText(text);
  if (actors.length < 1 && workflow.length < 2) return null;

  const actorRows = (actors.length ? actors : ["사용자", "시스템"]).map((name, i) => ({
    id: `baseline-a${i + 1}`,
    name: String(name).trim(),
    kind: inferActorKind(name),
    description: "",
  }));

  const stepTitles =
    workflow.length >= 2 ?
      workflow
    : actors.length ?
      [`${actors[0]} 요청·입력`, "처리·변환", "결과 확인"]
    : ["입력", "처리", "결과 확인"];

  const steps = stepTitles.map((title, i) => ({
    id: `baseline-s${i + 1}`,
    title: String(title).trim(),
    purpose: String(title).trim(),
    order: i + 1,
    primaryActorId: actorRows[i % actorRows.length]?.id ?? actorRows[0].id,
    secondaryActorIds: [] as string[],
    approved: false,
    updatedAt: now,
  }));

  return {
    createdAt: now,
    updatedAt: now,
    actors: actorRows,
    steps,
  };
}

function flowHasUsableSteps(flow: RequirementsServiceFlowV1 | null | undefined): boolean {
  return (flow?.steps?.length ?? 0) >= 1;
}

function extractLastVisibleProposalFromRecent(recentMessages: string): string {
  const lines = String(recentMessages ?? "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^AI\s*:/i.test(l));
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const body = lines[i].replace(/^AI\s*:\s*/i, "").trim();
    if (body.length >= 48 && hasProposalFirstStructure(body)) return body;
  }
  return "";
}

function extractProposalFromIdeationAssets(
  assets: ReadonlyArray<{ type?: string; title?: string; content?: string }> | undefined,
): string {
  for (const a of assets ?? []) {
    const content = String(a?.content ?? "").trim();
    if (content.length < 60) continue;
    if (hasProposalFirstStructure(content) || /예상\s*(서비스\s*)?흐름|예상\s*액터/.test(content)) {
      return content;
    }
  }
  return "";
}

export function resolveAlternativeBaseline(input: {
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly recentMessages?: string;
  readonly ideationAssets?: ReadonlyArray<{ type?: string; title?: string; content?: string }>;
  readonly priorScreenHandoff?: string;
  readonly nowIso?: string;
}): AlternativeBaseline | null {
  const nowIso = input.nowIso ?? new Date().toISOString();

  if (input.currentFlow && flowHasUsableSteps(input.currentFlow)) {
    return {
      source: "currentFlow",
      flow: input.currentFlow,
      referenceText: buildFlowReferenceText(input.currentFlow),
    };
  }

  const accepted = String(input.currentFlow?.acceptedProposalSnapshot ?? "").trim();
  if (accepted) {
    const fromAccepted = buildRequirementsServiceFlowFromProposalText(accepted, nowIso);
    if (fromAccepted) {
      return {
        source: "acceptedProposalSnapshot",
        flow: { ...fromAccepted, acceptedProposalSnapshot: accepted },
        referenceText: accepted,
      };
    }
  }

  const lastVisible = extractLastVisibleProposalFromRecent(input.recentMessages ?? "");
  if (lastVisible) {
    const fromVisible = buildRequirementsServiceFlowFromProposalText(lastVisible, nowIso);
    if (fromVisible) {
      return { source: "lastVisibleProposal", flow: fromVisible, referenceText: lastVisible };
    }
  }

  const fromAssets = extractProposalFromIdeationAssets(input.ideationAssets);
  if (fromAssets) {
    const fromBootstrap = buildRequirementsServiceFlowFromProposalText(fromAssets, nowIso);
    if (fromBootstrap) {
      return { source: "bootstrapProposalDraft", flow: fromBootstrap, referenceText: fromAssets };
    }
  }

  const handoff = String(input.priorScreenHandoff ?? "").trim();
  if (handoff) {
    const handoffBody = extractHandoffSummaryBody(handoff) || handoff;
    const fromHandoff = buildRequirementsServiceFlowFromProposalText(handoffBody, nowIso);
    if (fromHandoff) {
      return { source: "priorScreenHandoff", flow: fromHandoff, referenceText: handoffBody };
    }
  }

  if (input.currentFlow && (input.currentFlow.actors?.length || input.currentFlow.steps?.length)) {
    return {
      source: "currentFlow",
      flow: input.currentFlow,
      referenceText: buildFlowReferenceText(input.currentFlow),
    };
  }

  return null;
}

export function buildFlowReferenceText(flow: RequirementsServiceFlowV1): string {
  const actors = (flow.actors ?? []).map((a) => a.name).filter(Boolean);
  const steps = [...(flow.steps ?? [])].sort((a, b) => a.order - b.order).map((s) => s.title);
  return JSON.stringify({ actors, steps }).slice(0, 4000);
}

export function buildAlternativeBaselineFailureUserMessage(): string {
  return [
    "기준 흐름이 아직 저장되지 않아 다른 대안을 만들 수 없습니다.",
    "",
    "먼저 **추천안 적용**으로 현재 초안을 반영하거나, 흐름을 직접 입력해 주세요.",
  ].join("\n");
}

export const ALTERNATIVE_BASELINE_FAILURE_QUICK_REPLIES = [
  "추천안 적용",
  "일부 수정",
  "직접 입력",
] as const;
