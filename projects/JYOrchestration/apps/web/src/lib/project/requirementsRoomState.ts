import {
  isRequirementsMessage,
  newRequirementsMessage,
  type RequirementsMessage,
  type RequirementsMessageMeta,
  type RequirementsMessageRole,
  type RequirementsMessageTarget,
} from "@/lib/requirements/requirementsMessage";
import { dedupeMemberRefs } from "@/lib/requirements/requirementsTargets";
import { newConversation, type RequirementsConversation } from "@/lib/requirements/conversationStore";
import type { RequirementsDraftDoc } from "@/lib/requirements/draftStore";

export type RequirementsChatRole = RequirementsMessageRole;

export type RequirementsRoomStateV3 = {
  v: 3;
  requirementsConversation: RequirementsConversation;
  requirementsDraft?: RequirementsDraftDoc | null;
  /** 보기용(derived) */
  meetingNotes?: string;
  openIssues?: string;
  priorityFeatures?: string;
  aiQuestionIndex?: number;
};

const emptyState = (): RequirementsRoomStateV3 => ({
  v: 3,
  requirementsConversation: newConversation(""),
  requirementsDraft: null,
  aiQuestionIndex: 0,
});

function normalizeV1ToV2(messages: unknown[]): RequirementsMessage[] {
  const out: RequirementsMessage[] = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const row = m as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const role = row.role as RequirementsChatRole;
    const body = typeof row.body === "string" ? row.body : "";
    if (!id || !body) continue;
    if (role !== "user" && role !== "ai" && role !== "human" && role !== "system") continue;
    const at = typeof row.at === "string" ? row.at : new Date().toISOString();
    const authorName = typeof row.authorName === "string" ? row.authorName : undefined;
    const directedToId =
      typeof row.directedToId === "string" ? row.directedToId : row.directedToId === null ? null : undefined;
    const directedToName =
      typeof row.directedToName === "string" ? row.directedToName : row.directedToName === null ? null : undefined;

    out.push(
      newRequirementsMessage({
        id,
        createdAt: at,
        role,
        speakerType: role === "user" ? "USER" : role === "ai" ? "AI" : role === "human" ? "HUMAN" : "SYSTEM",
        speakerId: role === "user" ? "me" : role === "ai" ? "ai" : role === "human" ? "member" : "system",
        speakerName: authorName ?? (role === "user" ? "나" : role === "ai" ? "AI" : role === "human" ? "멤버" : "시스템"),
        targetId: directedToId ?? null,
        targetName: directedToName ?? null,
        messageType: role === "system" ? "NOTICE" : role === "ai" ? "ANSWER" : directedToName ? "QUESTION" : "STATEMENT",
        content: body,
      })
    );
  }
  return out;
}

export function parseRequirementsRoomState(raw: unknown | null | undefined): RequirementsRoomStateV3 {
  if (!raw || typeof raw !== "object") return emptyState();
  const o = raw as Record<string, unknown>;
  const v = Number(o.v ?? 0);
  const rawMsgs = Array.isArray(o.messages) ? o.messages : [];
  if (v === 1) {
    const norm = normalizeV1ToV2(rawMsgs);
    return {
      v: 3,
      requirementsConversation: newConversation(String((o as any).projectId ?? ""), norm),
      requirementsDraft: null,
      meetingNotes: typeof o.meetingNotes === "string" ? o.meetingNotes : undefined,
      openIssues: typeof o.openIssues === "string" ? o.openIssues : undefined,
      priorityFeatures: typeof o.priorityFeatures === "string" ? o.priorityFeatures : undefined,
      aiQuestionIndex: typeof o.aiQuestionIndex === "number" && Number.isFinite(o.aiQuestionIndex) ? o.aiQuestionIndex : 0,
    };
  }
  if (v === 2) {
    // 기존 구현(v2): messages + draft 를 v3로 승격
    const normalized: RequirementsMessage[] = [];
    for (const m of rawMsgs) {
      if (!isRequirementsMessage(m)) continue;
      normalized.push(m);
    }
    return {
      v: 3,
      requirementsConversation: newConversation(String((o as any).projectId ?? ""), normalized),
      requirementsDraft: ((o as any).draft as RequirementsDraftDoc | null | undefined) ?? null,
      meetingNotes: typeof o.meetingNotes === "string" ? o.meetingNotes : undefined,
      openIssues: typeof o.openIssues === "string" ? o.openIssues : undefined,
      priorityFeatures: typeof o.priorityFeatures === "string" ? o.priorityFeatures : undefined,
      aiQuestionIndex: typeof o.aiQuestionIndex === "number" && Number.isFinite(o.aiQuestionIndex) ? o.aiQuestionIndex : 0,
    };
  }
  if (v !== 3) return emptyState();

  const convRaw = (o.requirementsConversation ?? null) as unknown;
  const draftRaw = (o.requirementsDraft ?? null) as unknown;
  const convObj =
    convRaw && typeof convRaw === "object" ? (convRaw as Record<string, unknown>) : ({} as Record<string, unknown>);
  const convMsgsRaw = Array.isArray(convObj.messages) ? convObj.messages : [];
  const convMsgs: RequirementsMessage[] = [];
  for (const m of convMsgsRaw) {
    if (!isRequirementsMessage(m)) continue;
    convMsgs.push(m);
  }
  const projectId = typeof convObj.projectId === "string" ? convObj.projectId : "";
  const conv: RequirementsConversation = {
    projectId,
    stage: "REQUIREMENTS",
    messages: convMsgs,
  };

  return {
    v: 3,
    requirementsConversation: conv,
    requirementsDraft: (draftRaw as RequirementsDraftDoc | null | undefined) ?? null,
    meetingNotes: typeof o.meetingNotes === "string" ? o.meetingNotes : undefined,
    openIssues: typeof o.openIssues === "string" ? o.openIssues : undefined,
    priorityFeatures: typeof o.priorityFeatures === "string" ? o.priorityFeatures : undefined,
    aiQuestionIndex: typeof o.aiQuestionIndex === "number" && Number.isFinite(o.aiQuestionIndex) ? o.aiQuestionIndex : 0,
  };
}

/** 요구사항 대화 메시지·프로젝트 ID만 교체한 룸 스냅샷(저장·낙관적 UI용). */
export function patchRequirementsRoomConversationMessages(
  room: RequirementsRoomStateV3,
  resolvedProjectId: string,
  messages: readonly RequirementsMessage[]
): RequirementsRoomStateV3 {
  const pid = resolvedProjectId.trim();
  return {
    ...room,
    requirementsConversation: {
      ...room.requirementsConversation,
      projectId: pid,
      messages: [...messages],
    },
  };
}

/** UI 편의: 기존 호출부를 유지하면서 v2 메시지 생성 */
export function newChatMessage(partial: {
  role: RequirementsChatRole;
  body: string;
  authorName?: string;
  directedToId?: string | null;
  directedToName?: string | null;
  /** 복수 질문 대상(있으면 directedTo*와 동기화) */
  targets?: readonly RequirementsMessageTarget[] | null;
  /** 답글(스레드)용 */
  replyTo?: string | null;
  speakerId?: string;
  speakerName?: string;
  speakerType?: "USER" | "AI" | "HUMAN" | "SYSTEM";
  messageType?: "QUESTION" | "STATEMENT" | "ANSWER" | "NOTICE" | "FRIENDLY_ERROR";
  meta?: Partial<RequirementsMessageMeta>;
}): RequirementsMessage {
  const role = partial.role;
  const speakerType =
    partial.speakerType ?? (role === "user" ? "USER" : role === "ai" ? "AI" : role === "human" ? "HUMAN" : "SYSTEM");
  const speakerName =
    partial.speakerName ?? partial.authorName ?? (role === "user" ? "나" : role === "ai" ? "AI" : role === "human" ? "멤버" : "시스템");
  const rawTargets: RequirementsMessageTarget[] =
    partial.targets && partial.targets.length > 0
      ? dedupeMemberRefs(partial.targets)
      : partial.directedToId
        ? [
            {
              id: String(partial.directedToId),
              name: String(partial.directedToName ?? "").trim() || String(partial.directedToId),
            },
          ]
        : [];
  const first = rawTargets[0];
  const hasNamedTargets = rawTargets.length > 0;
  const replyTo =
    partial.replyTo === null ? null : typeof partial.replyTo === "string" && partial.replyTo.trim() ? partial.replyTo.trim() : undefined;
  return newRequirementsMessage({
    role,
    speakerType,
    speakerId: partial.speakerId ?? (speakerType === "USER" ? "me" : speakerType === "AI" ? "ai" : speakerType === "HUMAN" ? "member" : "system"),
    speakerName,
    ...(replyTo !== undefined ? { replyTo } : {}),
    targetId: first?.id ?? partial.directedToId ?? null,
    targetName: first?.name ?? partial.directedToName ?? null,
    ...(rawTargets.length > 0 ? { targets: rawTargets } : {}),
    messageType:
      partial.messageType ??
      (role === "system" ? "NOTICE" : role === "ai" ? "ANSWER" : hasNamedTargets ? "QUESTION" : "STATEMENT"),
    content: partial.body,
    ...(partial.meta ? { meta: partial.meta } : {}),
  });
}

export const VIRTUAL_AI_PLANNER_ID = "virtual:ai-planner" as const;
