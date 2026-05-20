/**
 * Actor ↔ Step structured relations (not description-string parsing).
 */

import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";
import {
  actorStatusDisplayLabel,
  computeAssignmentDiffLines,
  isActorCandidate,
  normalizeActorStatus,
} from "@/lib/requirements/serviceFlowActorAssignment";

export type ServiceFlowActorParticipationStatus = import("@/lib/requirements/requirementsStateJson").RequirementsServiceFlowActorParticipationStatus;

export type ServiceFlowStructuredActorMutationMeta = Readonly<{
  readonly mutationSource: "actor_drawer";
  readonly actorId: string;
  readonly affectedStepIds: readonly string[];
  readonly projectionId?: string;
  readonly createdAt: string;
}>;

export type StepActorAssignmentView = Readonly<{
  readonly stepId: string;
  readonly stepTitle: string;
  readonly order: number;
  readonly primaryActorName: string | null;
  readonly secondaryActorNames: readonly string[];
  readonly candidateActorNames: readonly string[];
  readonly partialActorNames: readonly string[];
}>;

export type ActorRelatedStepView = Readonly<{
  readonly stepId: string;
  readonly stepTitle: string;
  readonly order: number;
  readonly role: "primary" | "secondary" | "candidate" | "partial";
}>;

export function isCandidateActor(actor: RequirementsServiceFlowActorV1): boolean {
  return isActorCandidate(actor);
}

export function actorNameById(
  actors: readonly RequirementsServiceFlowActorV1[],
  actorId: string,
): string | null {
  const id = actorId.trim();
  if (!id) return null;
  return actors.find((a) => a.id === id)?.name.trim() ?? null;
}

export function applyCandidateActorStepRelations(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly actorId: string;
  readonly relatedStepIds: readonly string[];
  readonly nowIso: string;
}): RequirementsServiceFlowV1 {
  const actorId = input.actorId.trim();
  const stepIdSet = new Set(input.relatedStepIds.map((id) => id.trim()).filter(Boolean));
  if (!actorId || !stepIdSet.size) {
    return { ...input.flow, updatedAt: input.nowIso };
  }

  const steps = (input.flow.steps ?? []).map((step) => {
    if (!stepIdSet.has(step.id)) return step;
    if (step.primaryActorId === actorId) return { ...step, updatedAt: input.nowIso };
    const secondary = [...step.secondaryActorIds];
    if (!secondary.includes(actorId)) secondary.push(actorId);
    return {
      ...step,
      secondaryActorIds: secondary,
      approved: false,
      updatedAt: input.nowIso,
    };
  });

  return { ...input.flow, steps, updatedAt: input.nowIso };
}

export function buildStepActorAssignmentViews(
  flow: RequirementsServiceFlowV1,
): readonly StepActorAssignmentView[] {
  const actors = flow.actors ?? [];
  const actorById = new Map(actors.map((a) => [a.id, a]));

  return [...(flow.steps ?? [])]
    .sort((a, b) => a.order - b.order)
    .map((step) => {
      const primary = actorById.get(step.primaryActorId);
      const secondaryActorNames: string[] = [];
      const candidateActorNames: string[] = [];
      const partialActorNames: string[] = [];

      for (const sid of step.secondaryActorIds) {
        const a = actorById.get(sid);
        if (!a) continue;
        const name = a.name.trim();
        if (!name) continue;
        const st = normalizeActorStatus(a);
        if (st === "candidate") candidateActorNames.push(name);
        else if (st === "partial") partialActorNames.push(name);
        else secondaryActorNames.push(name);
      }

      const primarySt = primary ? normalizeActorStatus(primary) : null;

      return {
        stepId: step.id,
        stepTitle: step.title.trim(),
        order: step.order,
        primaryActorName: primary
          ? `${primary.name.trim()} (${actorStatusDisplayLabel(primarySt ?? "confirmed")})`
          : null,
        secondaryActorNames,
        candidateActorNames,
        partialActorNames,
      };
    });
}

export function buildActorRelatedStepViews(
  flow: RequirementsServiceFlowV1,
  actorId: string,
): readonly ActorRelatedStepView[] {
  const id = actorId.trim();
  const actor = (flow.actors ?? []).find((a) => a.id === id);
  if (!actor) return [];

  const st = normalizeActorStatus(actor);
  const out: ActorRelatedStepView[] = [];

  for (const step of flow.steps ?? []) {
    if (step.primaryActorId === id) {
      out.push({
        stepId: step.id,
        stepTitle: step.title.trim(),
        order: step.order,
        role: st === "candidate" ? "candidate" : st === "partial" ? "partial" : "primary",
      });
      continue;
    }
    if (step.secondaryActorIds.includes(id)) {
      out.push({
        stepId: step.id,
        stepTitle: step.title.trim(),
        order: step.order,
        role: st === "candidate" ? "candidate" : st === "partial" ? "partial" : "secondary",
      });
    }
  }

  return out.sort((a, b) => a.order - b.order);
}

/** alternative flow 비교 — assignment lifecycle diff */
export function computeStepAssignmentDiffLines(
  baselineFlow: RequirementsServiceFlowV1,
  alternativeFlow: RequirementsServiceFlowV1,
): readonly string[] {
  return computeAssignmentDiffLines(baselineFlow, alternativeFlow);
}

export function formatStepActorAssignmentLine(view: StepActorAssignmentView): string {
  const parts: string[] = [];
  if (view.primaryActorName) parts.push(`주: ${view.primaryActorName}`);
  if (view.secondaryActorNames.length) parts.push(`보조: ${view.secondaryActorNames.join(", ")}`);
  if (view.partialActorNames.length) parts.push(`부분: ${view.partialActorNames.join(", ")}`);
  if (view.candidateActorNames.length) parts.push(`후보: ${view.candidateActorNames.join(", ")}`);
  const actors = parts.length ? ` (${parts.join(" · ")})` : "";
  return `${view.order}. ${view.stepTitle}${actors}`;
}
