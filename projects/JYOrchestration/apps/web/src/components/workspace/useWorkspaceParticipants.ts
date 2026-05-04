"use client";

import { useMemo } from "react";
import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import { buildWorkspaceAiParticipantOptions } from "@/lib/ai-member/platformAiMembers";
import { displayedWorkspaceAiStatusForContext, showInternalAgents } from "@/lib/ai-member/visibleAiOrchestrator";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import type { MemberRow, RequirementsWorkspaceStage, SessionUser } from "@/lib/requirements/requirementsWorkspaceHelpers";

export function resolveParticipantContextKey(
  activeStage: RequirementsWorkspaceStage,
  override?: WorkspaceAiMemberId
): WorkspaceAiMemberId {
  if (override) return override;
  return activeStage === "service-flow" ? "actor_flow" : "ideation";
}

export function useWorkspaceParticipants(params: {
  readonly members: readonly MemberRow[];
  readonly sessionUser: SessionUser | null;
  readonly activeStage: RequirementsWorkspaceStage;
  readonly aiPlannerStatusLabel: string;
  /** 기능정리·프로토타입 등 — 이 화면에 참여하는 플랫폼 AI(복수). 없으면 스테이지 기본 1명. */
  readonly participantContextKeys?: readonly WorkspaceAiMemberId[];
  /** @deprecated participantContextKeys 사용 */
  readonly participantContextKey?: WorkspaceAiMemberId;
  /** 플랫폼 AI별 최근 작업 스니펫(참여 멤버 패널) */
  readonly platformMemberActivity?: Partial<
    Record<WorkspaceAiMemberId, { readonly recentSnippet?: string; readonly statusHint?: string }>
  >;
}): { readonly participants: readonly ParticipantOption[]; readonly participantBadgeCount: number } {
  const { members, sessionUser, activeStage, aiPlannerStatusLabel, participantContextKey, participantContextKeys, platformMemberActivity } =
    params;

  const aiMembers = useMemo(() => members.filter((m) => m.memberType === "AI"), [members]);

  const currentKeys = useMemo((): readonly WorkspaceAiMemberId[] => {
    if (participantContextKeys !== undefined) return participantContextKeys;
    return [resolveParticipantContextKey(activeStage, participantContextKey)];
  }, [activeStage, participantContextKey, participantContextKeys]);

  const defaultStatus = useMemo(() => displayedWorkspaceAiStatusForContext(currentKeys[0] ?? "ideation"), [currentKeys]);

  const participants = useMemo((): ParticipantOption[] => {
    const list: ParticipantOption[] = [];
    const platformRows = buildWorkspaceAiParticipantOptions({
      currentMemberIds: currentKeys,
      statusLabelForCurrent: aiPlannerStatusLabel || defaultStatus,
      activityByMember: platformMemberActivity,
    });

    if (showInternalAgents) {
      list.push(...platformRows);
      const platformNames = new Set(platformRows.map((p) => p.name));
      for (const m of aiMembers) {
        const name = (m.displayName || m.email || "AI").slice(0, 24);
        if (platformNames.has(name)) continue;
        list.push({
          id: m.memberId,
          name,
          kind: "ai",
          onlineHint: false,
          aiStatusLabel: aiPlannerStatusLabel,
          roleLabel: "AI",
        });
      }
    } else {
      list.push(...platformRows);
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
  }, [members, aiMembers, sessionUser?.id, aiPlannerStatusLabel, currentKeys, defaultStatus, platformMemberActivity]);

  return { participants, participantBadgeCount: participants.length };
}
