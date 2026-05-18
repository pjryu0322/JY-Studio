import type { ParticipantOption } from "@/components/workspace/workspaceParticipantTypes";
import type { WorkshopMessage } from "@/components/service-flow/serviceFlowWorkshopTypes";
import { buildWorkspaceAiParticipantOptions } from "@/lib/ai-member/platformAiMembers";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { displayedWorkspaceAiStatusForContext, displayedWorkspaceAiTitle, showInternalAgents } from "@/lib/ai-member/visibleAiOrchestrator";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { newChatMessage, VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import { SERVICE_FLOW_WORKSHOP_INTERNAL_TYPE } from "@/lib/requirements/serviceFlowConversation";

export type ServiceFlowProjectMember = {
  memberId: string;
  displayName: string | null;
  email: string | null;
  memberType: string;
  role: string;
  isOwner?: boolean;
  userId?: string | null;
  aiOrchestrationRole?: string | null;
  orchestrationStage?: string | null;
};

export function workshopMessageFromPersisted(m: RequirementsMessage, aiDisplayName: string): WorkshopMessage {
  const body = String(m.content ?? "").trim();
  if (m.role === "user") {
    return { id: m.id, role: "user", name: "사용자", body };
  }
  if (m.role === "human") {
    return { id: m.id, role: "member", name: (m.speakerName || "멤버").trim() || "멤버", body };
  }
  if (m.role === "ai") {
    const name = showInternalAgents ? (m.speakerName || aiDisplayName).trim() || aiDisplayName : aiDisplayName;
    return { id: m.id, role: "ai", name, body };
  }
  return { id: m.id, role: "expert", name: (m.speakerName || "시스템").trim() || "시스템", body };
}

export function buildServiceFlowUserPersist(body: string, currentUserId: string | null): RequirementsMessage {
  return newChatMessage({
    role: "user",
    body,
    speakerType: "USER",
    speakerId: currentUserId?.trim() || "me",
    messageType: "STATEMENT",
    meta: { internalType: SERVICE_FLOW_WORKSHOP_INTERNAL_TYPE },
  });
}

export function buildServiceFlowAiPersist(body: string): RequirementsMessage {
  const name = displayedWorkspaceAiTitle("actor_flow");
  return newChatMessage({
    role: "ai",
    body,
    speakerType: "AI",
    speakerId: VIRTUAL_AI_PLANNER_ID,
    speakerName: name,
    messageType: "ANSWER",
    meta: { internalType: SERVICE_FLOW_WORKSHOP_INTERNAL_TYPE },
  });
}

/** 아이디어 구체화 화면 참여 멤버와 동일한 ParticipantOption 구성(이 단계에 노출할 사람만 필터). */
export function serviceFlowSidebarParticipants(
  members: readonly ServiceFlowProjectMember[],
  currentUserId: string | null,
  ideationParticipantHumanMemberIds: readonly string[],
  replying: boolean,
  /** 이 화면(서비스 흐름)에 참여하는 플랫폼 AI — 없으면 AI 분석가만 */
  platformScreenAiMemberIds?: readonly WorkspaceAiMemberId[],
): ParticipantOption[] {
  const allowSet = new Set(ideationParticipantHumanMemberIds);
  const filteredHumans = members.filter((m) => {
    if (m.memberType !== "HUMAN") return false;
    if (currentUserId && m.userId && m.userId === currentUserId) return true;
    return allowSet.has(m.memberId);
  });

  const aiMembers = members.filter((m) => m.memberType === "AI");
  const aiStatusLabel = replying ? "반영 중…" : displayedWorkspaceAiStatusForContext("actor_flow");
  const list: ParticipantOption[] = [];
  const platformRows = buildWorkspaceAiParticipantOptions({
    currentMemberIds: platformScreenAiMemberIds?.length ? [...platformScreenAiMemberIds] : ["actor_flow"],
    statusLabelForCurrent: aiStatusLabel,
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
        aiStatusLabel,
        roleLabel: "AI",
      });
    }
  } else {
    list.push(...platformRows);
  }

  for (const m of filteredHumans) {
    const uid = m.userId ?? null;
    list.push({
      id: m.memberId,
      name: (m.displayName || m.email || "멤버").slice(0, 24),
      kind: "human",
      onlineHint: Boolean(currentUserId && uid && currentUserId === uid),
      roleLabel: m.isOwner ? "소유자" : "전문가",
      invited: !uid,
    });
  }

  const seen = new Set<string>();
  return list.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}
