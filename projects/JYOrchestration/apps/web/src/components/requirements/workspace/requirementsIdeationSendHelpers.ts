import { IDEATION_AI_DISPLAY_NAME } from "@/lib/requirements/ideationAiDisplayName";
import { inferRecentAiQuestionReplyParentId } from "@/lib/requirements/requirementsAnswerContext";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { computedTargetsFromInput, dedupeMemberRefs, type RequirementMemberRef } from "@/lib/requirements/requirementsTargets";
import { newChatMessage, VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";

export function newIdeationSendTraceId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `send-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

/** 멘션·답글 컨텍스트에서 사용자 메시지 한 턴을 순수하게 조립합니다. */
export function composeIdeationSendUserTurn(params: {
  readonly text: string;
  readonly replyToId: string | null;
  readonly conversationMessages: readonly RequirementsMessage[];
  readonly ideationConversationOnly: readonly RequirementsMessage[];
  readonly participants: readonly RequirementMemberRef[];
  readonly sessionUserId: string;
  readonly sessionUserName: string;
  readonly aiQuestionIndex: number | undefined;
  readonly isAiTarget: (targetId: string) => boolean;
}): {
  readonly targets: RequirementMemberRef[];
  readonly anyAi: boolean;
  readonly effectiveReplyTo: string | null;
  readonly userMsg: RequirementsMessage;
  readonly msgs: RequirementsMessage[];
  readonly turn: number;
} {
  const fromMentions = computedTargetsFromInput(params.text, params.participants);
  const targets = dedupeMemberRefs(
    fromMentions.length ? fromMentions : [{ id: VIRTUAL_AI_PLANNER_ID, name: IDEATION_AI_DISPLAY_NAME }]
  );
  const anyAi = targets.some((t) => params.isAiTarget(t.id));
  const effectiveReplyTo = inferRecentAiQuestionReplyParentId(params.ideationConversationOnly, params.replyToId);

  const userMsg = newChatMessage({
    role: "user",
    body: params.text,
    targets,
    ...(effectiveReplyTo ? { replyTo: effectiveReplyTo } : {}),
    speakerId: params.sessionUserId,
    speakerName: params.sessionUserName,
    speakerType: "USER",
    messageType: targets.length ? "QUESTION" : "STATEMENT",
  });

  return {
    targets,
    anyAi,
    effectiveReplyTo,
    userMsg,
    msgs: [...params.conversationMessages, userMsg],
    turn: params.aiQuestionIndex ?? 0,
  };
}
