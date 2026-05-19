/**
 * Cross-stage proposal visible-message dedupe (ideation bootstrap → service-flow handoff).
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import { hasProposalFirstStructure } from "@/lib/requirements/requirementsBootstrapInterviewQuality";
import { isServiceFlowProposalBootstrapTurn } from "@/lib/requirements/serviceFlowAnalyzeValidation";

export type ProposalFingerprintStage = "ideation" | "service-flow";

export type ProposalFingerprint = Readonly<{
  stage: ProposalFingerprintStage;
  normalizedSummaryHash: string;
  normalizedActorsHash: string;
  normalizedWorkflowHash: string;
}>;

export type ServiceFlowVisibleMode = "visible_proposal" | "handoff_state_only" | "visible_delta";

export type ServiceFlowVisiblePresentation = Readonly<{
  mode: ServiceFlowVisibleMode;
  suppressVisibleMessage: boolean;
  suppressReason?: string;
  visibleAssistantMessage: string;
  visibleQuickReplies: string[] | null;
  fingerprint: ProposalFingerprint;
}>;

function normToken(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/^\d+[.)]\s*/, "");
}

function hashTokens(tokens: readonly string[]): string {
  const sorted = [...new Set(tokens.map(normToken).filter((t) => t.length >= 2))].sort();
  if (!sorted.length) return "";
  let h = 5381;
  const joined = sorted.join("|");
  for (let i = 0; i < joined.length; i += 1) h = (h * 33) ^ joined.charCodeAt(i);
  return `h${(h >>> 0).toString(16)}`;
}

function extractBulletSectionItems(text: string, sectionRe: RegExp, untilRe: RegExp): string[] {
  const lines = String(text ?? "").split("\n");
  const items: string[] = [];
  let inSection = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (sectionRe.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && untilRe.test(line)) break;
    if (inSection && /^[-*•]\s+/.test(line)) {
      items.push(line.replace(/^[-*•]\s+/, "").trim());
    }
    if (inSection && /^\d+[.)]\s+/.test(line)) {
      items.push(line.replace(/^\d+[.)]\s+/, "").trim());
    }
  }
  return items.filter(Boolean);
}

export function extractActorsFromProposalText(text: string): string[] {
  return extractBulletSectionItems(text, /예상\s*액터/i, /예상\s*(서비스\s*)?흐름|추천:|다음:/i);
}

export function extractWorkflowFromProposalText(text: string): string[] {
  const numbered = extractBulletSectionItems(text, /예상\s*(서비스\s*)?흐름/i, /예상\s*액터|추천:|다음:/i);
  if (numbered.length) return numbered;
  const lines = String(text ?? "").split("\n");
  const items: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (/^\d+[.)]\s+/.test(line)) items.push(line.replace(/^\d+[.)]\s+/, "").trim());
  }
  return items.filter(Boolean);
}

export function buildProposalFingerprintFromText(
  stage: ProposalFingerprintStage,
  text: string,
): ProposalFingerprint {
  const actors = extractActorsFromProposalText(text);
  const workflow = extractWorkflowFromProposalText(text);
  const summaryLine =
    String(text ?? "")
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length >= 12 && !/^예상/.test(l) && !/^[-*•\d]/.test(l)) ?? "";
  return {
    stage,
    normalizedSummaryHash: hashTokens([summaryLine]),
    normalizedActorsHash: hashTokens(actors),
    normalizedWorkflowHash: hashTokens(workflow),
  };
}

export function buildProposalFingerprintFromFlow(flow: RequirementsServiceFlowV1): ProposalFingerprint {
  const actors = (flow.actors ?? []).map((a) => a.name).filter(Boolean);
  const workflow = [...(flow.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((s) => s.title)
    .filter(Boolean);
  return {
    stage: "service-flow",
    normalizedSummaryHash: "",
    normalizedActorsHash: hashTokens(actors),
    normalizedWorkflowHash: hashTokens(workflow),
  };
}

function jaccardSimilarity(a: readonly string[], b: readonly string[]): number {
  const na = [...new Set(a.map(normToken).filter((x) => x.length >= 2))];
  const nb = [...new Set(b.map(normToken).filter((x) => x.length >= 2))];
  if (!na.length && !nb.length) return 1;
  if (!na.length || !nb.length) return 0;
  const setB = new Set(nb);
  let inter = 0;
  for (const x of na) if (setB.has(x)) inter += 1;
  const union = new Set([...na, ...nb]).size;
  return union ? inter / union : 0;
}

export function proposalFingerprintsStructurallySimilar(
  a: ProposalFingerprint,
  b: ProposalFingerprint,
): boolean {
  if (
    a.normalizedActorsHash &&
    b.normalizedActorsHash &&
    a.normalizedActorsHash === b.normalizedActorsHash &&
    a.normalizedWorkflowHash &&
    b.normalizedWorkflowHash &&
    a.normalizedWorkflowHash === b.normalizedWorkflowHash
  ) {
    return true;
  }
  if (
    a.normalizedWorkflowHash &&
    b.normalizedWorkflowHash &&
    a.normalizedWorkflowHash === b.normalizedWorkflowHash &&
    a.normalizedWorkflowHash.length > 4
  ) {
    return true;
  }
  return false;
}

export function proposalTextsStructurallySimilar(textA: string, textB: string): boolean {
  const fpA = buildProposalFingerprintFromText("ideation", textA);
  const fpB = buildProposalFingerprintFromText("service-flow", textB);
  if (proposalFingerprintsStructurallySimilar(fpA, fpB)) return true;

  const actorsSim = jaccardSimilarity(extractActorsFromProposalText(textA), extractActorsFromProposalText(textB));
  const flowSim = jaccardSimilarity(extractWorkflowFromProposalText(textA), extractWorkflowFromProposalText(textB));
  const actorsEnough =
    extractActorsFromProposalText(textA).length >= 2 && extractActorsFromProposalText(textB).length >= 2;
  const flowEnough =
    extractWorkflowFromProposalText(textA).length >= 3 && extractWorkflowFromProposalText(textB).length >= 3;

  if (actorsEnough && flowEnough && actorsSim >= 0.75 && flowSim >= 0.7) return true;
  if (flowEnough && flowSim >= 0.85) return true;
  return false;
}

/** 클라이언트 silentUserAppend 등 — 사용자가 직접 입력한 턴이 아님 */
export function isSilentServiceFlowAutoHandoffStart(input: {
  readonly userMessage: string;
  readonly autoHandoff?: boolean;
}): boolean {
  if (input.autoHandoff === true) return true;
  const um = String(input.userMessage ?? "").trim();
  return /^서비스\s*흐름\s*인터뷰\s*시작$/i.test(um);
}

/** visible_delta / visible_proposal 허용 — 명시적 사용자 의도가 있을 때만 */
export function isExplicitServiceFlowUserIntent(input: {
  readonly userMessage: string;
  readonly autoHandoff?: boolean;
  readonly quickActionLabel?: string | null;
  readonly priorScreenHandoff?: string;
}): boolean {
  if (input.autoHandoff === true) return false;

  const qa = String(input.quickActionLabel ?? "").trim();
  if (qa) {
    if (/다른\s*대안|일부\s*수정|직접\s*입력|보류|그대로\s*진행|단계\s*수정|빠진\s*단계/.test(qa)) return true;
    if (/추천안\s*적용/.test(qa) && !isSilentServiceFlowAutoHandoffStart({ userMessage: input.userMessage })) {
      return true;
    }
  }

  const um = String(input.userMessage ?? "").trim();
  if (!um) return false;

  if (
    isSilentServiceFlowAutoHandoffStart({ userMessage: um }) &&
    String(input.priorScreenHandoff ?? "").trim()
  ) {
    return false;
  }

  if (/정리\s*요청|다시\s*정리|재정리|다른\s*대안|수정해|직접|빠진\s*단계/.test(um)) return true;
  if (!/^서비스\s*흐름\s*인터뷰\s*시작$/i.test(um)) return true;
  return false;
}

function isGenericPlaceholderDeltaItem(title: string): boolean {
  const n = normToken(title);
  if (!n) return true;
  return /(목표입력|요청을처리|결과를확인|확인조정|사용자가목표|시스템이요청|제공한다|처리한다)$/.test(n);
}

function hasMeaningfulHandoffDelta(addedSteps: readonly string[], addedActors: readonly string[]): boolean {
  const items = [...addedSteps, ...addedActors].map((x) => String(x ?? "").trim()).filter(Boolean);
  const meaningful = items.filter((x) => !isGenericPlaceholderDeltaItem(x));
  return meaningful.length > 0;
}

export function isIdeationCrossStageHandoffContext(input: {
  readonly priorScreenHandoff: string;
  readonly userMessage: string;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
}): boolean {
  const handoff = String(input.priorScreenHandoff ?? "").trim();
  if (!handoff || !/이전\s*담당:\s*ideation/i.test(handoff)) return false;
  if (!isServiceFlowProposalBootstrapTurn({ userMessage: input.userMessage, currentFlow: input.currentFlow })) {
    return false;
  }
  return /인터뷰\s*시작/.test(String(input.userMessage ?? ""));
}

export function extractHandoffSummaryBody(priorScreenHandoff: string): string {
  const handoff = String(priorScreenHandoff ?? "").trim();
  const idx = handoff.indexOf("요약:");
  if (idx >= 0) return handoff.slice(idx + "요약:".length).trim();
  return handoff;
}

function findAddedTitles(baseline: readonly string[], candidate: readonly string[]): string[] {
  const base = new Set(baseline.map(normToken).filter((x) => x.length >= 2));
  return candidate.filter((t) => {
    const n = normToken(t);
    return n.length >= 2 && !base.has(n);
  });
}

export function buildServiceFlowVisibleDeltaMessage(input: {
  readonly addedStepTitles: readonly string[];
  readonly addedActorNames: readonly string[];
}): string {
  const steps = input.addedStepTitles.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 6);
  const actors = input.addedActorNames.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 4);
  if (!steps.length && !actors.length) return "";

  const lines = ["서비스 흐름 초안은 기존 추천안을 기준으로 반영했습니다.", "", "추가로 정리된 항목:"];
  for (const a of actors) lines.push(`- ${a}`);
  for (const s of steps) lines.push(`- ${s}`);
  lines.push("", "다음: 세부 기능 정의로 이동하거나 일부 수정할 수 있습니다.");
  return lines.join("\n");
}

export function resolveServiceFlowVisiblePresentation(input: {
  readonly userMessage: string;
  readonly currentFlow: RequirementsServiceFlowV1 | null;
  readonly priorScreenHandoff: string;
  readonly assistantMessage: string;
  readonly nextQuestion: string | null;
  readonly quickReplies: string[] | null;
  readonly updatedFlow: RequirementsServiceFlowV1;
  readonly recentMessages?: string;
  readonly forceVisibleProposal?: boolean;
  /** true — ideation→service-flow 자동 handoff(silentUserAppend) */
  readonly autoHandoff?: boolean;
  readonly quickActionLabel?: string | null;
}): ServiceFlowVisiblePresentation {
  const mergedVisible = [String(input.assistantMessage ?? "").trim(), String(input.nextQuestion ?? "").trim()]
    .filter(Boolean)
    .join("\n\n");
  const newFp = buildProposalFingerprintFromFlow(input.updatedFlow);
  const textFp = buildProposalFingerprintFromText("service-flow", mergedVisible);

  const handoffBootstrap = isIdeationCrossStageHandoffContext({
    priorScreenHandoff: input.priorScreenHandoff,
    userMessage: input.userMessage,
    currentFlow: input.currentFlow,
  });

  const explicitUserIntent = isExplicitServiceFlowUserIntent({
    userMessage: input.userMessage,
    autoHandoff: input.autoHandoff,
    quickActionLabel: input.quickActionLabel,
    priorScreenHandoff: input.priorScreenHandoff,
  });

  const handoffSummary = extractHandoffSummaryBody(input.priorScreenHandoff);

  const recent = String(input.recentMessages ?? "");

  const baselineText = handoffSummary || "";
  const baselineActors = extractActorsFromProposalText(baselineText);
  const baselineWorkflow = extractWorkflowFromProposalText(baselineText);
  const newActors = (input.updatedFlow.actors ?? []).map((a) => a.name);
  const newSteps = [...(input.updatedFlow.steps ?? [])].sort((a, b) => a.order - b.order).map((s) => s.title);
  const addedActors = findAddedTitles(baselineActors, newActors);
  const addedSteps = findAddedTitles(baselineWorkflow, newSteps);

  const similarToHandoff =
    Boolean(baselineText) && Boolean(mergedVisible) && proposalTextsStructurallySimilar(baselineText, mergedVisible);
  const lastAiInRecent = recent
    ? recent
        .split(/\n/)
        .filter((l) => l.startsWith("AI:"))
        .map((l) => l.replace(/^AI:\s*/, "").trim())
        .filter((b) => b.length > 40 && hasProposalFirstStructure(b))
        .pop()
    : undefined;
  const similarToRecent =
    Boolean(lastAiInRecent) &&
    Boolean(mergedVisible) &&
    proposalTextsStructurallySimilar(lastAiInRecent ?? "", mergedVisible);

  if (input.forceVisibleProposal) {
    return {
      mode: "visible_proposal",
      suppressVisibleMessage: false,
      visibleAssistantMessage: mergedVisible,
      visibleQuickReplies: input.quickReplies,
      fingerprint: textFp,
    };
  }

  if (handoffBootstrap && !explicitUserIntent) {
    return {
      mode: "handoff_state_only",
      suppressVisibleMessage: true,
      suppressReason: "initial_cross_stage_handoff_state_only",
      visibleAssistantMessage: "",
      visibleQuickReplies: null,
      fingerprint: newFp,
    };
  }

  if (handoffBootstrap && explicitUserIntent && hasMeaningfulHandoffDelta(addedSteps, addedActors)) {
    const delta = buildServiceFlowVisibleDeltaMessage({
      addedStepTitles: addedSteps,
      addedActorNames: addedActors,
    });
    if (delta && !proposalTextsStructurallySimilar(baselineText || mergedVisible, delta)) {
      return {
        mode: "visible_delta",
        suppressVisibleMessage: false,
        visibleAssistantMessage: delta,
        visibleQuickReplies: input.quickReplies,
        fingerprint: newFp,
      };
    }
  }

  if (handoffBootstrap) {
    return {
      mode: "handoff_state_only",
      suppressVisibleMessage: true,
      suppressReason: "duplicate_cross_stage_proposal",
      visibleAssistantMessage: "",
      visibleQuickReplies: null,
      fingerprint: newFp,
    };
  }

  if ((similarToHandoff || similarToRecent) && hasProposalFirstStructure(mergedVisible)) {
    return {
      mode: "handoff_state_only",
      suppressVisibleMessage: true,
      suppressReason: similarToHandoff ? "duplicate_cross_stage_proposal" : "duplicate_proposal_fingerprint",
      visibleAssistantMessage: "",
      visibleQuickReplies: null,
      fingerprint: newFp,
    };
  }

  return {
    mode: "visible_proposal",
    suppressVisibleMessage: false,
    visibleAssistantMessage: mergedVisible,
    visibleQuickReplies: input.quickReplies,
    fingerprint: newFp,
  };
}

export function shouldPersistServiceFlowAiMessage(presentation: ServiceFlowVisiblePresentation): boolean {
  return !presentation.suppressVisibleMessage && Boolean(presentation.visibleAssistantMessage.trim());
}

export function shouldSuppressServiceFlowVisibleFromResponse(input: {
  readonly visibleMessageSuppressed?: boolean;
  readonly visibleMode?: ServiceFlowVisibleMode;
  readonly suppressReason?: string;
}): boolean {
  if (input.visibleMessageSuppressed === true) return true;
  if (input.visibleMode === "handoff_state_only") return true;
  const reason = String(input.suppressReason ?? "").trim();
  if (reason && /handoff|cross_stage|duplicate_proposal/i.test(reason)) return true;
  return false;
}
