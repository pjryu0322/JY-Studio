/**
 * Actor assignment lifecycle — structured step.primary / secondary mutations.
 */

import type {
  RequirementsServiceFlowActorParticipationStatus,
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";
import { actorNameById } from "@/lib/requirements/serviceFlowActorStepMapping";

export type ActorAssignmentAction =
  | "confirm_actor"
  | "set_primary"
  | "add_secondary"
  | "remove_secondary"
  | "reassign";

export type ActorAssignmentType = "primary" | "secondary" | "candidate";

export type ServiceFlowAssignmentMutationMeta = Readonly<{
  readonly mutationSource: "assignment_drawer";
  readonly assignmentAction: ActorAssignmentAction;
  readonly stepId: string;
  readonly previousActorId?: string;
  readonly nextActorId?: string;
  readonly assignmentType: ActorAssignmentType;
  readonly affectedStepIds: readonly string[];
  readonly projectionId?: string;
  readonly createdAt: string;
}>;

export type ServiceFlowAssignmentEditDraft = Readonly<{
  readonly stepId: string;
  readonly primaryActorId: string;
  readonly secondaryActorIds: readonly string[];
  /** 승격할 candidate actor ids */
  readonly confirmActorIds: readonly string[];
  readonly replacePrimaryConfirmed: boolean;
}>;

export function normalizeActorStatus(
  actor: RequirementsServiceFlowActorV1,
): RequirementsServiceFlowActorParticipationStatus {
  if (actor.status === "candidate" || actor.status === "partial" || actor.status === "confirmed" || actor.status === "obsolete") {
    return actor.status;
  }
  if (actor.id.startsWith("actor-candidate-")) return "candidate";
  return "confirmed";
}

export function isActorCandidate(actor: RequirementsServiceFlowActorV1): boolean {
  return normalizeActorStatus(actor) === "candidate";
}

export function actorStatusDisplayLabel(status: RequirementsServiceFlowActorParticipationStatus): string {
  if (status === "candidate") return "후보";
  if (status === "partial") return "부분";
  if (status === "obsolete") return "폐기";
  return "확정";
}

function patchActors(
  flow: RequirementsServiceFlowV1,
  actorId: string,
  patch: Partial<RequirementsServiceFlowActorV1>,
  nowIso: string,
): RequirementsServiceFlowV1 {
  const actors = (flow.actors ?? []).map((a) => (a.id === actorId ? { ...a, ...patch } : a));
  return { ...flow, actors, updatedAt: nowIso };
}

/** candidate → confirmed (또는 partial 경유 없이 직접 확정) */
export function confirmActorInFlow(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly actorId: string;
  readonly nowIso: string;
}): RequirementsServiceFlowV1 {
  const id = input.actorId.trim();
  if (!id) return input.flow;
  return patchActors(input.flow, id, { status: "confirmed" }, input.nowIso);
}

export function promoteActorToPartial(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly actorId: string;
  readonly nowIso: string;
}): RequirementsServiceFlowV1 {
  const id = input.actorId.trim();
  if (!id) return input.flow;
  return patchActors(input.flow, id, { status: "partial" }, input.nowIso);
}

export function markActorObsolete(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly actorId: string;
  readonly nowIso: string;
}): RequirementsServiceFlowV1 {
  const id = input.actorId.trim();
  if (!id) return input.flow;
  return patchActors(input.flow, id, { status: "obsolete" }, input.nowIso);
}

/** primary 지정 시 actor confirmed 승격 (정책 B) */
export function setStepPrimaryActor(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly stepId: string;
  readonly actorId: string;
  readonly replacePrimaryConfirmed: boolean;
  readonly nowIso: string;
}): RequirementsServiceFlowV1 {
  const stepId = input.stepId.trim();
  const actorId = input.actorId.trim();
  if (!stepId || !actorId) return input.flow;

  const step = (input.flow.steps ?? []).find((s) => s.id === stepId);
  if (!step) return input.flow;

  const prevPrimary = step.primaryActorId;
  if (prevPrimary && prevPrimary !== actorId && !input.replacePrimaryConfirmed) {
    return input.flow;
  }

  let next = confirmActorInFlow({ flow: input.flow, actorId, nowIso: input.nowIso });

  const steps = (next.steps ?? []).map((s) => {
    if (s.id !== stepId) return s;
    const secondary = s.secondaryActorIds.filter((id) => id !== actorId);
    return {
      ...s,
      primaryActorId: actorId,
      secondaryActorIds: secondary,
      approved: false,
      updatedAt: input.nowIso,
    };
  });

  return { ...next, steps, updatedAt: input.nowIso };
}

export function setStepSecondaryActorIds(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly stepId: string;
  readonly actorIds: readonly string[];
  readonly nowIso: string;
}): RequirementsServiceFlowV1 {
  const stepId = input.stepId.trim();
  const primary = (input.flow.steps ?? []).find((s) => s.id === stepId)?.primaryActorId ?? "";
  const ids = [...new Set(input.actorIds.map((id) => id.trim()).filter((id) => id && id !== primary))];

  const steps = (input.flow.steps ?? []).map((s) =>
    s.id === stepId
      ? { ...s, secondaryActorIds: ids, approved: false, updatedAt: input.nowIso }
      : s,
  );
  return { ...input.flow, steps, updatedAt: input.nowIso };
}

export function removeSecondaryActorFromStep(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly stepId: string;
  readonly actorId: string;
  readonly nowIso: string;
}): RequirementsServiceFlowV1 {
  const stepId = input.stepId.trim();
  const actorId = input.actorId.trim();
  const steps = (input.flow.steps ?? []).map((s) => {
    if (s.id !== stepId) return s;
    return {
      ...s,
      secondaryActorIds: s.secondaryActorIds.filter((id) => id !== actorId),
      updatedAt: input.nowIso,
    };
  });
  return { ...input.flow, steps, updatedAt: input.nowIso };
}

export function assignmentDraftFromStep(
  flow: RequirementsServiceFlowV1,
  stepId: string,
): ServiceFlowAssignmentEditDraft | null {
  const step = (flow.steps ?? []).find((s) => s.id === stepId);
  if (!step) return null;
  return {
    stepId: step.id,
    primaryActorId: step.primaryActorId,
    secondaryActorIds: [...step.secondaryActorIds],
    confirmActorIds: [],
    replacePrimaryConfirmed: false,
  };
}

export function applyAssignmentEditToFlow(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly draft: ServiceFlowAssignmentEditDraft;
  readonly projectionId?: string;
  readonly nowIso?: string;
}): RequirementsServiceFlowV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const stepId = input.draft.stepId.trim();
  const step = (input.flow.steps ?? []).find((s) => s.id === stepId);
  if (!step) return input.flow;

  const prevPrimary = step.primaryActorId;
  const nextPrimary = input.draft.primaryActorId.trim();
  let next = input.flow;

  for (const aid of input.draft.confirmActorIds) {
    next = confirmActorInFlow({ flow: next, actorId: aid, nowIso: now });
  }

  let assignmentAction: ActorAssignmentAction = "reassign";
  let assignmentType: ActorAssignmentType = "primary";

  if (nextPrimary && nextPrimary !== prevPrimary) {
    next = setStepPrimaryActor({
      flow: next,
      stepId,
      actorId: nextPrimary,
      replacePrimaryConfirmed: input.draft.replacePrimaryConfirmed,
      nowIso: now,
    });
    assignmentAction = "set_primary";
    assignmentType = "primary";
  }

  const prevSec = new Set(step.secondaryActorIds);
  const nextSec = new Set(
    input.draft.secondaryActorIds.map((id) => id.trim()).filter((id) => id && id !== nextPrimary),
  );

  next = setStepSecondaryActorIds({ flow: next, stepId, actorIds: [...nextSec], nowIso: now });

  const removed = [...prevSec].filter((id) => !nextSec.has(id));
  const added = [...nextSec].filter((id) => !prevSec.has(id));
  if (assignmentAction !== "set_primary") {
    if (removed.length && !added.length) {
      assignmentAction = "remove_secondary";
      assignmentType = "secondary";
    } else if (added.length) {
      assignmentAction = "add_secondary";
      assignmentType = "secondary";
    }
  }

  const meta: ServiceFlowAssignmentMutationMeta = {
    mutationSource: "assignment_drawer",
    assignmentAction,
    stepId,
    assignmentType,
    affectedStepIds: [stepId],
    createdAt: now,
    ...(prevPrimary !== nextPrimary
      ? { previousActorId: prevPrimary, nextActorId: nextPrimary }
      : {}),
    ...(input.projectionId?.trim() ? { projectionId: input.projectionId.trim() } : {}),
  };

  return {
    ...next,
    updatedAt: now,
    lastProposalDecision: "STRUCTURED_ACTOR_ASSIGN",
    conversationState: next.conversationState ?? "REVIEW",
    lastAssignmentMutation: meta,
  };
}

/** assignment diff — candidate→confirmed, primary/secondary/reassign */
export function computeAssignmentDiffLines(
  baselineFlow: RequirementsServiceFlowV1,
  alternativeFlow: RequirementsServiceFlowV1,
): readonly string[] {
  const lines: string[] = [];

  const baseActors = new Map((baselineFlow.actors ?? []).map((a) => [a.id, a]));
  for (const alt of alternativeFlow.actors ?? []) {
    const base = baseActors.get(alt.id);
    if (!base) continue;
    const bSt = normalizeActorStatus(base);
    const aSt = normalizeActorStatus(alt);
    if (bSt === "candidate" && aSt === "confirmed") {
      lines.push(`~ ${alt.name}: 후보 담당 → 확정 (${actorStatusDisplayLabel(aSt)})`);
    } else if (bSt !== aSt) {
      lines.push(`~ ${alt.name}: ${actorStatusDisplayLabel(bSt)} → ${actorStatusDisplayLabel(aSt)}`);
    }
  }

  const baseByTitle = new Map<string, (typeof baselineFlow.steps)[number]>();
  for (const s of baselineFlow.steps ?? []) {
    const t = s.title.trim().toLowerCase();
    if (t && !baseByTitle.has(t)) baseByTitle.set(t, s);
  }

  for (const alt of alternativeFlow.steps ?? []) {
    const key = alt.title.trim().toLowerCase();
    if (!key) continue;
    const base = baseByTitle.get(key);
    if (!base) continue;

    if (base.primaryActorId !== alt.primaryActorId) {
      const fromName = actorNameById(baselineFlow.actors ?? [], base.primaryActorId) ?? "—";
      const toName = actorNameById(alternativeFlow.actors ?? [], alt.primaryActorId) ?? "—";
      const fromActor = (baselineFlow.actors ?? []).find((a) => a.id === base.primaryActorId);
      const fromLabel = fromActor && isActorCandidate(fromActor) ? `후보 담당 ${fromName}` : fromName;
      lines.push(`~ ${alt.title}: ${fromLabel} → 주 담당 ${toName}`);
    }

    const baseSec = new Set(base.secondaryActorIds);
    const altSec = new Set(alt.secondaryActorIds);
    for (const sid of altSec) {
      if (baseSec.has(sid)) continue;
      const name = actorNameById(alternativeFlow.actors ?? [], sid);
      const actor = (alternativeFlow.actors ?? []).find((a) => a.id === sid);
      if (name) {
        const prefix = actor && isActorCandidate(actor) ? "후보" : "보조";
        lines.push(`+ ${alt.title}: ${prefix} 담당 ${name}`);
      }
    }
    for (const sid of baseSec) {
      if (altSec.has(sid)) continue;
      const name = actorNameById(baselineFlow.actors ?? [], sid);
      if (name) lines.push(`- ${alt.title}: 보조 담당 ${name} 제거`);
    }
  }

  return lines.slice(0, 16);
}
