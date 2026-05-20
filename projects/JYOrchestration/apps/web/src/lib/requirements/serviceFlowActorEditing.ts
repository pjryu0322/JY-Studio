/**
 * Service-flow actor structured editing — Drawer mutation (not chat-only intent).
 */

import type {
  RequirementsServiceFlowActorV1,
  RequirementsServiceFlowV1,
} from "@/lib/requirements/requirementsStateJson";

export type ServiceFlowActorType = "human" | "system" | "ai" | "external";

export type ServiceFlowActorEditDraft = Readonly<{
  readonly name: string;
  readonly actorType: ServiceFlowActorType;
  readonly description: string;
  readonly role: string;
  readonly automation: "manual" | "auto";
  readonly relatedStepIds: readonly string[];
}>;

export type ActorEditingPhase =
  | "IDLE"
  | "ENTER_EDIT"
  | "EDITING"
  | "SAVE_PENDING"
  | "RECOMPUTE"
  | "CONFIRMED"
  | "FAILED";

export function nextActorEditingPhase(
  current: ActorEditingPhase,
  event: "open" | "edit" | "save" | "recompute_ok" | "recompute_fail" | "close",
): ActorEditingPhase {
  switch (current) {
    case "IDLE":
      return event === "open" ? "ENTER_EDIT" : "IDLE";
    case "ENTER_EDIT":
      if (event === "close") return "IDLE";
      if (event === "edit") return "EDITING";
      return "ENTER_EDIT";
    case "EDITING":
      if (event === "close") return "IDLE";
      if (event === "save") return "SAVE_PENDING";
      return "EDITING";
    case "SAVE_PENDING":
      if (event === "recompute_ok") return "CONFIRMED";
      if (event === "recompute_fail") return "FAILED";
      return "SAVE_PENDING";
    case "RECOMPUTE":
      if (event === "recompute_ok") return "CONFIRMED";
      if (event === "recompute_fail") return "FAILED";
      return "RECOMPUTE";
    case "CONFIRMED":
    case "FAILED":
      return event === "close" ? "IDLE" : current;
    default:
      return "IDLE";
  }
}

function wireKindFromActorType(type: ServiceFlowActorType): RequirementsServiceFlowActorV1["kind"] {
  if (type === "system" || type === "ai") return "system";
  return "human";
}

function newActorId(flow: RequirementsServiceFlowV1): string {
  const ids = new Set((flow.actors ?? []).map((a) => a.id));
  for (let i = 1; i < 200; i += 1) {
    const id = `actor-candidate-${i}`;
    if (!ids.has(id)) return id;
  }
  return `actor-candidate-${Date.now()}`;
}

/** candidate actor를 flow에 추가하고 structured mutation 메타 설정 */
export function appendCandidateActorToFlow(input: {
  readonly flow: RequirementsServiceFlowV1;
  readonly draft: ServiceFlowActorEditDraft;
  readonly nowIso?: string;
}): RequirementsServiceFlowV1 {
  const now = input.nowIso ?? new Date().toISOString();
  const name = input.draft.name.trim();
  if (!name) return input.flow;

  const descParts = [
    input.draft.description.trim(),
    input.draft.role.trim() ? `역할: ${input.draft.role.trim()}` : "",
    input.draft.automation === "auto" ? "자동 처리" : "수동 처리",
    input.draft.relatedStepIds.length
      ? `관련 단계: ${input.draft.relatedStepIds.join(", ")}`
      : "",
  ].filter(Boolean);

  const actor: RequirementsServiceFlowActorV1 = {
    id: newActorId(input.flow),
    name,
    kind: wireKindFromActorType(input.draft.actorType),
    description: descParts.join("\n").slice(0, 2000) || null,
  };

  return {
    ...input.flow,
    actors: [...(input.flow.actors ?? []), actor],
    updatedAt: now,
    lastProposalDecision: "STRUCTURED_ACTOR_ADD",
    conversationState: input.flow.conversationState ?? "REVIEW",
  };
}

export function emptyActorEditDraft(): ServiceFlowActorEditDraft {
  return {
    name: "",
    actorType: "human",
    description: "",
    role: "",
    automation: "manual",
    relatedStepIds: [],
  };
}
