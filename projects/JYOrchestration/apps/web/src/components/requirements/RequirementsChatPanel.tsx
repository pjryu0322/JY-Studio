"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { normalizeRequirementsMessageText } from "@/lib/requirements/requirementsMessageDisplay";
import { formatTargetNamesForUi, getMessageTargets } from "@/lib/requirements/requirementsTargets";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import { IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE } from "@/lib/requirements/ideationInterviewBootstrap";
import {
  IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE,
  IDEATION_PROBLEM_INTERVIEW_COMPLETE_INTERNAL_TYPE,
} from "@/lib/requirements/ideationInterviewBootstrap";
import {
  IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
  parseIdeationDeliverableChatPayload,
} from "@/lib/requirements/ideationDeliverables";
import {
  PROBLEM_INTERVIEW_SLOTS,
  problemInterviewSlotLabelKr,
  type ProblemInterviewSlot,
  type ProblemInterviewState,
} from "@/lib/requirements/problemInterview";
import { RequirementsChatHeaderRow } from "@/components/requirements/RequirementsChatHeaderRow";
import { WorkspaceComposerFooter } from "@/components/workspace/WorkspaceComposerFooter";
import { WorkspaceMessageList } from "@/components/workspace/WorkspaceMessageList";
import { WorkspaceProgressPill } from "@/components/workspace/WorkspaceProgressPill";
import { WorkspaceResultCard } from "@/components/workspace/WorkspaceResultCard";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useWorkspaceScrollToEnd } from "@/components/workspace/useWorkspaceScroll";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";
import { WorkspaceAiHeaderWithAvatar } from "@/components/ai-member/WorkspaceAiHeaderWithAvatar";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { displayedWorkspaceAiTitle, showInternalAgents } from "@/lib/ai-member/visibleAiOrchestrator";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  WORKSPACE_STANDARD_CHAT_BODY_STYLE,
  WORKSPACE_STANDARD_CHAT_HEADER_STYLE,
  workspaceStandardChatBubbleShell,
} from "@/components/workspace/workspaceStandardChatMessage";

function aiCardShell(tone: "default" | "notice" | "error"): CSSProperties {
  const base = workspaceStandardChatBubbleShell("ai");
  if (tone === "error") return { ...base, background: "#fef2f2", border: `1px solid #fecaca` };
  if (tone === "notice") return { ...base, background: "#f0f9ff", border: `1px solid #bae6fd` };
  return base;
}

export function RequirementsChatPanel({
  messages,
  composer,
  typingIndicator,
  ideationInterviewUi,
  onInsertComposerPrompt,
  onSetReplyTo,
  onOpenDeliverableDocument,
  onOpenDeliverableList,
  onOpenDeliverableDocuments,
  onRegenerateDeliverables,
  onConfirmDeliverables,
  memberControls,
  screenAiMemberId = "ideation",
}: {
  readonly messages: readonly RequirementsMessage[] | null;
  readonly composer: ReactNode;
  /** AI 응답 대기 중 표시(채팅 타임라인에는 저장되지 않음) */
  readonly typingIndicator?: boolean;
  readonly ideationInterviewUi?: {
    readonly active: boolean;
    readonly readinessPercent: number;
    readonly covered: number;
    readonly strictFilled: number;
    readonly total: number;
    readonly nextSlot: ProblemInterviewSlot | null;
    readonly remainingQuestionsEstimate: number;
    readonly slotState: ProblemInterviewState | null;
    readonly recentAskedSlots: readonly ProblemInterviewSlot[];
    readonly onForceGeneratePlanNow: () => void;
  } | null;
  readonly onInsertComposerPrompt?: (text: string) => void;
  /** 답글 달기: replyTo messageId 설정 */
  readonly onSetReplyTo?: (messageId: string, preview: string) => void;
  readonly onOpenDeliverableDocument?: (assetId: string) => void;
  /** 프로젝트 산출물 목록(탐색) */
  readonly onOpenDeliverableList?: (focusAssetId: string | null) => void;
  readonly onOpenDeliverableDocuments?: (assetIds: readonly string[]) => void;
  readonly onRegenerateDeliverables?: (requestedTypes: readonly string[]) => void;
  readonly onConfirmDeliverables?: (assetIds: readonly string[]) => void;
  /** 아이디어 구체화 참여 멤버 보기(상단 아이콘) */
  readonly memberControls?: { count: number; onOpen: () => void } | null;
  /** 이 채팅 패널이 속한 화면의 전담 AI(표시명·내부 에이전트 병행 시 폴백) */
  readonly screenAiMemberId?: WorkspaceAiMemberId;
}) {
  const showScreenLabels = useShowScreenLabels();
  const endRef = useWorkspaceScrollToEnd(`${(messages?.length ?? 0)}-${typingIndicator ? 1 : 0}`);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const headerRef = useRef<HTMLDivElement | null>(null);
  /** 원문 messageId → 다음에 스크롤할 답글 인덱스(순환) */
  const replyCycleIndexRef = useRef<Map<string, number>>(new Map());

  const firstIsOnboarding = Boolean(
    messages &&
      messages[0] &&
      messages[0].role === "ai" &&
      messages[0].speakerId === VIRTUAL_AI_PLANNER_ID &&
      messages[0].meta?.internalType === IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE
  );

  const canQuote = Boolean(onInsertComposerPrompt);
  const canReply = Boolean(onSetReplyTo);

  const messageById = useMemo(() => {
    const map = new Map<string, RequirementsMessage>();
    for (const m of messages ?? []) map.set(m.id, m);
    return map;
  }, [messages]);

  const repliesByParentId = useMemo(() => {
    const map = new Map<string, { id: string; createdAt: string }[]>();
    for (const m of messages ?? []) {
      const pid = typeof m.replyTo === "string" ? m.replyTo.trim() : "";
      if (!pid) continue;
      const list = map.get(pid) ?? [];
      list.push({ id: m.id, createdAt: m.createdAt });
      map.set(pid, list);
    }
    const out = new Map<string, string[]>();
    for (const [pid, rows] of map.entries()) {
      rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      out.set(
        pid,
        rows.map((r) => r.id)
      );
    }
    return out;
  }, [messages]);

  useEffect(() => {
    const next = new Map<string, number>();
    for (const [parentId, ids] of repliesByParentId.entries()) {
      const prev = replyCycleIndexRef.current.get(parentId) ?? 0;
      next.set(parentId, ids.length ? prev % ids.length : 0);
    }
    replyCycleIndexRef.current = next;
  }, [repliesByParentId]);

  const scrollToMessage = useCallback((id: string) => {
    const el = messageRefs.current.get(id) ?? null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const scrollToNextReply = useCallback(
    (parentMessageId: string) => {
      const ids = repliesByParentId.get(parentMessageId) ?? [];
      if (!ids.length) return;
      const cur = replyCycleIndexRef.current.get(parentMessageId) ?? 0;
      const id = ids[cur % ids.length] ?? ids[0];
      scrollToMessage(id);
      replyCycleIndexRef.current.set(parentMessageId, (cur + 1) % ids.length);
    },
    [repliesByParentId, scrollToMessage]
  );

  const repliesBadgeStyle = useMemo(
    () =>
      ({
        border: "1px solid rgba(226, 232, 240, 0.95)",
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(6px)",
        borderRadius: 999,
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 900,
        color: "#475569",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }) satisfies CSSProperties,
    []
  );

  const quoteTextFor = useCallback((raw: string) => {
    const text = normalizeRequirementsMessageText(raw).trim();
    const first = text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)[0] ?? "";
    const clipped = first.length > 120 ? `${first.slice(0, 120)}…` : first;
    return clipped;
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }, []);

  const hoverActionBtn = useMemo(
    () =>
      ({
        border: "1px solid rgba(226, 232, 240, 0.95)",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(6px)",
        borderRadius: 10,
        padding: "7px 10px",
        fontSize: 12.5,
        fontWeight: 800,
        color: "#334155",
        cursor: "pointer",
        boxShadow: "0 10px 28px -18px rgba(15, 23, 42, 0.25)",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }) satisfies CSSProperties,
    []
  );

  const interviewUi = ideationInterviewUi ?? null;
  const membersUi = memberControls ?? null;

  const topChrome =
    interviewUi || membersUi ? (
      <RequirementsChatHeaderRow
        ref={headerRef}
        memberControls={membersUi}
        leading={interviewUi ? <WorkspaceProgressPill interviewUi={interviewUi} headerRef={headerRef} /> : null}
      />
    ) : null;

  const messageBody = (
    <>
          {messages === null ? (
            <div style={{ fontSize: 13, color: "#71717a", marginBottom: 12 }}>
              <ScreenLabel label="요구사항-채팅영역-로딩상태" visible={showScreenLabels} />
              <ScreenLabel label="요구사항-불러오기상태" visible={showScreenLabels} />
              대화 이력을 불러오는 중입니다…
            </div>
          ) : messages.length === 0 ? (
            <div style={{ fontSize: 13, color: "#71717a", marginBottom: 12 }}>
              메시지가 여기에 쌓입니다. 아래에서 입력해 협의를 시작하세요.
            </div>
          ) : null}

          {(messages ?? []).map((m) => {
            const mine = m.role === "user";
            const tg = getMessageTargets(m);
            const targetLine = formatTargetNamesForUi(m) || (m.targetName ? String(m.targetName) : "");
            const showToMeta =
              mine &&
              targetLine &&
              (tg.length > 1 || tg.some((t) => t.id !== VIRTUAL_AI_PLANNER_ID));
            const replyToId = typeof m.replyTo === "string" && m.replyTo.trim() ? m.replyTo.trim() : null;
            const replied = replyToId ? messageById.get(replyToId) ?? null : null;
            const replyPreview = replied ? quoteTextFor(replied.content) : "";
            const replies = repliesByParentId.get(m.id) ?? [];
            const timeStr = new Date(m.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

            const replyContextLine =
              replyToId ? (
                <div style={{ fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 8 }} title={replyToId}>
                  <span>↪ 답글</span>
                  {replied ? (
                    <span style={{ fontWeight: 700, color: t.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {" "}
                      · {replied.speakerName ? `${replied.speakerName} · ` : ""}
                      {replyPreview || replyToId}
                    </span>
                  ) : (
                    <span style={{ fontWeight: 700, color: t.textMuted }}> · {replyToId}</span>
                  )}
                </div>
              ) : null;

            const repliesNavBtn =
              replies.length > 0 ? (
                <button
                  type="button"
                  onClick={() => scrollToNextReply(m.id)}
                  style={repliesBadgeStyle}
                  title="답글로 이동(클릭마다 다음 답글 순환)"
                >
                  답글 {replies.length}
                </button>
              ) : null;

            if (mine) {
              const text = normalizeRequirementsMessageText(m.content);
              return (
                <div
                  key={m.id}
                  ref={(el) => {
                    if (!el) {
                      messageRefs.current.delete(m.id);
                      return;
                    }
                    messageRefs.current.set(m.id, el);
                  }}
                  style={{ justifySelf: "end", maxWidth: "78%", width: "fit-content", minWidth: 0 }}
                >
                  <div style={workspaceStandardChatBubbleShell("user")}>
                    {replyContextLine}
                    <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>
                      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                        사용자
                        {showToMeta ? <span style={{ fontWeight: 600, color: t.textMuted }}> · To: {targetLine}</span> : null}
                        <span style={{ fontWeight: 700, color: t.textMuted }}> · {timeStr}</span>
                      </span>
                      {repliesNavBtn}
                    </div>
                    <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>{text}</div>
                  </div>
                </div>
              );
            }

            if (m.role === "human") {
              const text = normalizeRequirementsMessageText(m.content);
              const memberName = String(m.speakerName ?? "").trim() || "멤버";
              return (
                <div
                  key={m.id}
                  ref={(el) => {
                    if (!el) {
                      messageRefs.current.delete(m.id);
                      return;
                    }
                    messageRefs.current.set(m.id, el);
                  }}
                  style={{ justifySelf: "start", maxWidth: "min(100%, 620px)", width: "fit-content", minWidth: 0 }}
                >
                  <div style={workspaceStandardChatBubbleShell("member")}>
                    {replyContextLine}
                    <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>
                      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                        멤버 · {memberName}
                        <span style={{ fontWeight: 700, color: t.textMuted }}> · {timeStr}</span>
                      </span>
                      {repliesNavBtn}
                    </div>
                    <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>{text}</div>
                  </div>
                </div>
              );
            }

            if (m.role === "ai") {
              const text = normalizeRequirementsMessageText(m.content);
              const isErr = m.messageType === "FRIENDLY_ERROR";
              const interviewLastSlotRaw = String(m.meta?.problemInterviewLastSlot ?? "").trim();
              const interviewLastSlot: ProblemInterviewSlot | null =
                interviewLastSlotRaw && (PROBLEM_INTERVIEW_SLOTS as readonly string[]).includes(interviewLastSlotRaw)
                  ? (interviewLastSlotRaw as ProblemInterviewSlot)
                  : null;
              const isInterviewTurn =
                m.speakerId === VIRTUAL_AI_PLANNER_ID &&
                (m.meta?.internalType === IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE ||
                  m.meta?.internalType === IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE);
              const isInterviewCompleteNotice =
                m.speakerId === VIRTUAL_AI_PLANNER_ID && m.meta?.internalType === IDEATION_PROBLEM_INTERVIEW_COMPLETE_INTERNAL_TYPE;
              const deliverPayload =
                !isErr &&
                m.messageType === "NOTICE" &&
                m.meta?.internalType === IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE
                  ? parseIdeationDeliverableChatPayload(m.content)
                  : null;
              const tone = isErr ? "error" : m.messageType === "NOTICE" ? "notice" : "default";
              const showHoverActions = m.messageType === "ANSWER" && !isErr;
              const interviewPurposeBadge =
                !deliverPayload && !isErr && (isInterviewTurn || isInterviewCompleteNotice) && interviewUi ? (
                  <div
                    style={{
                      margin: "6px 0 0",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 999,
                      border: "1px solid rgba(226,232,240,0.95)",
                      background: "rgba(255,255,255,0.92)",
                      backdropFilter: "blur(6px)",
                      padding: "4px 10px",
                      fontSize: 11,
                      fontWeight: 900,
                      color: "#334155",
                    }}
                  >
                    <span>
                      {interviewLastSlot ? `${problemInterviewSlotLabelKr(interviewLastSlot)} 확인 중` : "인터뷰 진행 중"}
                    </span>
                    <span style={{ color: "#94a3b8" }}>|</span>
                    <span>
                      {interviewUi.covered}/{interviewUi.total}
                    </span>
                  </div>
                ) : null;
              const aiBody = deliverPayload ? (
                <WorkspaceResultCard
                  payload={deliverPayload}
                  onOpenDocument={(id) => onOpenDeliverableDocument?.(id)}
                  onOpenList={(focusId) => onOpenDeliverableList?.(focusId)}
                  onOpenAll={(ids) => onOpenDeliverableDocuments?.(ids)}
                  onRegenerate={(types) => onRegenerateDeliverables?.(types)}
                  onConfirm={(ids) => onConfirmDeliverables?.(ids)}
                />
              ) : (
                <RequirementsAiMessageMarkdown text={text} variant={isErr ? "error" : "default"} />
              );

              const defaultAiTitle = displayedWorkspaceAiTitle(screenAiMemberId);
              const aiSpeakerLine = !showInternalAgents
                ? defaultAiTitle
                : String(m.speakerName ?? "").trim() || defaultAiTitle;

              return (
                <div
                  key={m.id}
                  ref={(el) => {
                    if (!el) {
                      messageRefs.current.delete(m.id);
                      return;
                    }
                    messageRefs.current.set(m.id, el);
                  }}
                  style={{ justifySelf: "start", maxWidth: "min(100%, 620px)", width: "100%", minWidth: 0 }}
                >
                  <div
                    style={{ ...aiCardShell(tone), position: "relative" }}
                    onMouseEnter={() => setHoveredId(m.id)}
                    onMouseLeave={() => setHoveredId((cur) => (cur === m.id ? null : cur))}
                  >
                    {replyContextLine}
                    <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>
                      <WorkspaceAiHeaderWithAvatar memberId={screenAiMemberId} trailing={repliesNavBtn}>
                        AI · {aiSpeakerLine}
                        <span style={{ fontWeight: 700, color: t.textMuted }}> · {timeStr}</span>
                      </WorkspaceAiHeaderWithAvatar>
                    </div>
                    {interviewPurposeBadge}
                    <div style={{ ...WORKSPACE_STANDARD_CHAT_BODY_STYLE, marginTop: interviewPurposeBadge ? 6 : 0 }}>{aiBody}</div>
                    {showHoverActions && hoveredId === m.id ? (
                      <div
                        style={{
                          position: "absolute",
                          right: 8,
                          top: 8,
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          zIndex: 2,
                        }}
                        aria-label="메시지 액션"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!canQuote) return;
                            const q = quoteTextFor(m.content);
                            if (!q) return;
                            onInsertComposerPrompt?.(`[인용: ${q}]\n`);
                          }}
                          style={hoverActionBtn}
                          disabled={!canQuote}
                          title="질문하기(인용 삽입)"
                        >
                          ↩ 질문하기
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!canReply) return;
                            const q = quoteTextFor(m.content);
                            onSetReplyTo?.(m.id, q);
                          }}
                          style={hoverActionBtn}
                          disabled={!canReply}
                          title="답글달기(스레드)"
                        >
                          💬 답글달기
                        </button>
                        <button
                          type="button"
                          onClick={() => void copyToClipboard(text)}
                          style={hoverActionBtn}
                          title="복사"
                        >
                          📋 복사
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            }

            /* system */
            const text = normalizeRequirementsMessageText(m.content);
            const isErr = m.messageType === "FRIENDLY_ERROR";
            return (
              <div
                key={m.id}
                ref={(el) => {
                  if (!el) {
                    messageRefs.current.delete(m.id);
                    return;
                  }
                  messageRefs.current.set(m.id, el);
                }}
                style={{ justifySelf: "start", maxWidth: "min(100%, 620px)", width: "fit-content", minWidth: 0 }}
              >
                <div style={aiCardShell(isErr ? "error" : "notice")}>
                  {replyContextLine}
                  <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>
                    <span>
                      시스템<span style={{ fontWeight: 700, color: t.textMuted }}> · {timeStr}</span>
                    </span>
                    {repliesNavBtn}
                  </div>
                  <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>
                    <RequirementsAiMessageMarkdown text={text} variant={isErr ? "error" : "default"} />
                  </div>
                </div>
              </div>
            );
          })}

          {typingIndicator ? (
            <div style={{ justifySelf: "start", maxWidth: "min(100%, 620px)", width: "fit-content", minWidth: 0 }}>
              <div style={aiCardShell("notice")}>
                <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>
                  <WorkspaceAiHeaderWithAvatar memberId={screenAiMemberId}>
                    AI · {displayedWorkspaceAiTitle(screenAiMemberId)}
                    <span style={{ fontWeight: 700, color: t.textMuted }}>
                      {" "}
                      · {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </WorkspaceAiHeaderWithAvatar>
                </div>
                <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>
                  <span style={{ fontWeight: 800, marginRight: 6 }}>생각 중입니다</span>
                  <span className="jyo-typing" aria-label="typing indicator">
                    <span className="jyo-dot" />
                    <span className="jyo-dot" />
                    <span className="jyo-dot" />
                  </span>
                  <style>{`
                    .jyo-typing { display: inline-flex; gap: 4px; vertical-align: middle; }
                    .jyo-dot { width: 6px; height: 6px; border-radius: 999px; background: #0f766e; opacity: 0.35; animation: jyoDot 1.2s infinite; }
                    .jyo-dot:nth-child(2) { animation-delay: 0.15s; }
                    .jyo-dot:nth-child(3) { animation-delay: 0.3s; }
                    @keyframes jyoDot { 0%, 80%, 100% { transform: translateY(0); opacity: 0.25; } 40% { transform: translateY(-3px); opacity: 0.9; } }
                  `}</style>
                </div>
              </div>
            </div>
          ) : null}
    </>
  );

  return (
    <WorkspaceShell
      data-testid="requirements-chat-panel"
      top={topChrome}
      footer={<WorkspaceComposerFooter>{composer}</WorkspaceComposerFooter>}
    >
      <WorkspaceMessageList
        endRef={endRef}
        beforeMessages={
          <>
            <ScreenLabel label="요구사항-채팅영역-메시지타임라인" visible={showScreenLabels} />
            {firstIsOnboarding ? <ScreenLabel label="요구사항-채팅영역-초기안내메시지" visible={showScreenLabels} /> : null}
          </>
        }
      >
        {messageBody}
      </WorkspaceMessageList>
    </WorkspaceShell>
  );
}
