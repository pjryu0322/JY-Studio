/**
 * Service-flow proposal variant (PRIMARY / ALTERNATIVE) fingerprints & delta scoring.
 */

import type { RequirementsServiceFlowV1 } from "@/lib/requirements/requirementsStateJson";
import {
  buildProposalFingerprintFromFlow,
  buildProposalFingerprintFromText,
  proposalFingerprintsStructurallySimilar,
} from "@/lib/requirements/crossStageProposalDedupe";

export type ProposalVariantMode = "PRIMARY" | "ALTERNATIVE";

export type ServiceFlowReviewMode = "PRIMARY_REVIEW" | "ALTERNATIVE_REVIEW";

function normToken(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
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

export function fingerprintHashFromFlow(flow: RequirementsServiceFlowV1): string {
  const fp = buildProposalFingerprintFromFlow(flow);
  return [fp.normalizedActorsHash, fp.normalizedWorkflowHash].filter(Boolean).join("|") || "";
}

export function fingerprintHashFromAssistantMessage(message: string): string {
  const fp = buildProposalFingerprintFromText("service-flow", message);
  return [fp.normalizedActorsHash, fp.normalizedWorkflowHash].filter(Boolean).join("|") || "";
}

export function computeProposalFlowDeltaScore(
  previousFlow: RequirementsServiceFlowV1,
  candidateFlow: RequirementsServiceFlowV1,
): number {
  const prevSteps = (previousFlow.steps ?? []).map((s) => s.title).filter(Boolean);
  const candSteps = (candidateFlow.steps ?? []).map((s) => s.title).filter(Boolean);
  const prevActors = (previousFlow.actors ?? []).map((a) => a.name).filter(Boolean);
  const candActors = (candidateFlow.actors ?? []).map((a) => a.name).filter(Boolean);

  const prevFp = buildProposalFingerprintFromFlow(previousFlow);
  const candFp = buildProposalFingerprintFromFlow(candidateFlow);
  if (proposalFingerprintsStructurallySimilar(prevFp, candFp)) return 0;

  const workflowSim = jaccardSimilarity(prevSteps, candSteps);
  const actorsSim = jaccardSimilarity(prevActors, candActors);
  const combined = workflowSim * 0.65 + actorsSim * 0.35;
  const delta = 1 - combined;
  return Math.max(0, Math.min(1, Number(delta.toFixed(3))));
}

export function isAlternativeProposalInsufficientDelta(input: {
  readonly previousFlow: RequirementsServiceFlowV1;
  readonly candidateFlow: RequirementsServiceFlowV1;
  readonly minDeltaScore?: number;
}): boolean {
  const min = input.minDeltaScore ?? 0.18;
  const score = computeProposalFlowDeltaScore(input.previousFlow, input.candidateFlow);
  if (score < min) return true;
  const prevFp = buildProposalFingerprintFromFlow(input.previousFlow);
  const candFp = buildProposalFingerprintFromFlow(input.candidateFlow);
  return proposalFingerprintsStructurallySimilar(prevFp, candFp);
}

export function markFlowAsPrimaryProposalVariant(
  flow: RequirementsServiceFlowV1,
  nowIso?: string,
): RequirementsServiceFlowV1 {
  const now = nowIso ?? new Date().toISOString();
  const fp = fingerprintHashFromFlow(flow);
  return {
    ...flow,
    updatedAt: now,
    proposalVariantMode: "PRIMARY",
    reviewMode: "PRIMARY_REVIEW",
    primaryProposalFingerprint: fp || flow.primaryProposalFingerprint,
  };
}

export function markFlowAsAlternativeProposalVariant(
  flow: RequirementsServiceFlowV1,
  input: {
    readonly previousFlow: RequirementsServiceFlowV1;
    readonly deltaScore: number;
    readonly nowIso?: string;
  },
): RequirementsServiceFlowV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const primaryFp =
    input.previousFlow.primaryProposalFingerprint ||
    fingerprintHashFromFlow(input.previousFlow);
  const altFp = fingerprintHashFromFlow(flow);
  return {
    ...flow,
    updatedAt: now,
    proposalVariantMode: "ALTERNATIVE",
    reviewMode: "ALTERNATIVE_REVIEW",
    primaryProposalFingerprint: primaryFp,
    alternativeProposalFingerprint: altFp,
    conversationState: "REVIEW",
    lastProposalDecision: "ALTERNATIVE",
  };
}
