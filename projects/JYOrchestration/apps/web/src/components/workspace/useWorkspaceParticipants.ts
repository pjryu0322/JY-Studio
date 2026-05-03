"use client";

import { useMemo } from "react";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import {
  displayedAiOrchestrator,
  displayedAiStatusForStage,
  showInternalAgents,
  visibleStageFromRequirementsStage,
} from "@/lib/ai-member/visibleAiOrchestrator";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import type { MemberRow, SessionUser } from "@/lib/requirements/requirementsWorkspaceHelpers";
import type { RequirementsWorkspaceStage } from "@/lib/requirements/requirementsWorkspaceHelpers";

export function useWorkspaceParticipants(params: {
  readonly members: readonly MemberRow[];
  readonly sessionUser: SessionUser | null;
  readonly activeStage: RequirementsWorkspaceStage;
  readonly aiPlannerStatusLabel: string;
}): { readonly participants: readonly ParticipantOption[]; readonly participantBadgeCount: number } {
  const { members, sessionUser, activeStage, aiPlannerStatusLabel } = params;

  const aiMembers = useMemo(() => members.filter((m) => m.memberType === "AI"), [members]);

  const participants = useMemo((): ParticipantOption[] => {
    const list: ParticipantOption[] = [];
    if (showInternalAgents) {
      if (aiMembers.length === 0) {
        list.push({
          id: VIRTUAL_AI_PLANNER_ID,
          name: "AI 기획자",
          kind: "ai",
          onlineHint: false,
          aiStatusLabel: aiPlannerStatusLabel,
          roleLabel: "AI",
        });
      }
      for (const m of aiMembers) {
        list.push({
          id: m.memberId,
          name: (m.displayName || m.email || "AI").slice(0, 24),
          kind: "ai",
          onlineHint: false,
          aiStatusLabel: aiPlannerStatusLabel,
          roleLabel: "AI",
        });
      }
    } else {
      const stageKey = visibleStageFromRequirementsStage(activeStage);
      const orch = displayedAiOrchestrator();
      list.push({
        id: "visible:ai-orchestrator",
        name: orch.name,
        kind: "ai",
        onlineHint: false,
        aiStatusLabel: displayedAiStatusForStage(stageKey),
        roleLabel: "AI",
      });
    }
    for (const m of members) {
      if (m.memberType !== "HUMAN") continue;
      const uid = m.userId ?? null;
      const invited = !uid;
      list.push({
        id: m.memberId,
        name: (m.displayName || m.email || "멤버").slice(0, 24),
        kind: "human",
        onlineHint: Boolean(sessionUser?.id && uid && sessionUser.id === uid),
        roleLabel: m.isOwner ? "소유자" : "전문가",
        invited,
      });
    }
    const seen = new Set<string>();
    return list.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [members, aiMembers, sessionUser?.id, aiPlannerStatusLabel, activeStage]);

  return { participants, participantBadgeCount: participants.length };
}
