/**
 * Actor ↔ Step structured relations (not description-string parsing).
 */

import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowStepV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";

export type ServiceFlowActorParticipationStatus = "confirmed" | "candidate";

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
}>;

export type ActorRelatedStepView = Readonly<{
  readonly stepId: string;
  readonly stepTitle: string;
  readonly order: number;
  readonly role: "primary" | "secondary" | "candidate";
}>;

export function isCandidateActor(actor: RequirementsServiceFlowActorV1): boolean {
  if (actor.status === "candidate") return true;
  return actor.id.startsWith("actor-candidate-");
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

      for (const sid of step.secondaryActorIds) {
        const a = actorById.get(sid);
        if (!a) continue;
        const name = a.name.trim();
        if (!name) continue;
        if (isCandidateActor(a)) candidateActorNames.push(name);
        else secondaryActorNames.push(name);
      }

      return {
        stepId: step.id,
        stepTitle: step.title.trim(),
        order: step.order,
        primaryActorName: primary
          ? `${primary.name.trim()}${isCandidateActor(primary) ? " (후보)" : ""}`
          : null,
        secondaryActorNames,
        candidateActorNames,
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

  const candidate = isCandidateActor(actor);
  const out: ActorRelatedStepView[] = [];

  for (const step of flow.steps ?? []) {
    if (step.primaryActorId === id) {
      out.push({
        stepId: step.id,
        stepTitle: step.title.trim(),
        order: step.order,
        role: candidate ? "candidate" : "primary",
      });
      continue;
    }
    if (step.secondaryActorIds.includes(id)) {
      out.push({
        stepId: step.id,
        stepTitle: step.title.trim(),
        order: step.order,
        role: candidate ? "candidate" : "secondary",
      });
    }
  }

  return out.sort((a, b) => a.order - b.order);
}

/** alternative flow 비교 — step 담당 재배치 */
export function computeStepAssignmentDiffLines(
  baselineFlow: RequirementsServiceFlowV1,
  alternativeFlow: RequirementsServiceFlowV1,
): readonly string[] {
  const baseByTitle = new Map<string, RequirementsServiceFlowStepV1>();
  for (const s of baselineFlow.steps ?? []) {
    const t = s.title.trim().toLowerCase();
    if (t && !baseByTitle.has(t)) baseByTitle.set(t, s);
  }

  const lines: string[] = [];
  for (const alt of alternativeFlow.steps ?? []) {
    const key = alt.title.trim().toLowerCase();
    if (!key) continue;
    const base = baseByTitle.get(key);
    if (!base) continue;

    const basePrimary = actorNameById(baselineFlow.actors ?? [], base.primaryActorId) ?? "—";
    const altPrimary = actorNameById(alternativeFlow.actors ?? [], alt.primaryActorId) ?? "—";
    if (basePrimary !== altPrimary) {
      lines.push(`~ ${alt.title}: 주 담당 ${basePrimary} → ${altPrimary}`);
    }

    const baseSec = new Set(base.secondaryActorIds);
    const altSec = new Set(alt.secondaryActorIds);
    for (const sid of altSec) {
      if (baseSec.has(sid)) continue;
      const name = actorNameById(alternativeFlow.actors ?? [], sid);
      if (name) lines.push(`+ ${alt.title}: 보조/후보 ${name}`);
    }
    for (const sid of baseSec) {
      if (altSec.has(sid)) continue;
      const name = actorNameById(baselineFlow.actors ?? [], sid);
      if (name) lines.push(`- ${alt.title}: 보조/후보 ${name}`);
    }
  }

  return lines.slice(0, 12);
}

export function formatStepActorAssignmentLine(view: StepActorAssignmentView): string {
  const parts: string[] = [];
  if (view.primaryActorName) parts.push(`주: ${view.primaryActorName}`);
  if (view.secondaryActorNames.length) parts.push(`보조: ${view.secondaryActorNames.join(", ")}`);
  if (view.candidateActorNames.length) parts.push(`후보: ${view.candidateActorNames.join(", ")}`);
  const actors = parts.length ? ` (${parts.join(" · ")})` : "";
  return `${view.order}. ${view.stepTitle}${actors}`;
}
