"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { normalizeRequirementsMessageText } from "@/lib/requirements/requirementsMessageDisplay";
import { formatTargetNamesForUi, getMessageTargets } from "@/lib/requirements/requirementsTargets";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import { IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE } from "@/lib/requirements/ideationInterviewBootstrap";
import { IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE } from "@/lib/requirements/ideationInterviewBootstrap";
import {
  IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
  parseIdeationDeliverableChatPayload,
} from "@/lib/requirements/ideationDeliverables";
import type { ProblemInterviewState } from "@/lib/requirements/problemInterview";
import { formatSingleChatReplyReferenceLine } from "@/lib/requirements/singleChatReplyReference";
import { RequirementsChatHeaderRow } from "@/components/requirements/RequirementsChatHeaderRow";
import { WorkspaceComposerFooter } from "@/components/workspace/WorkspaceComposerFooter";
import { WorkspaceMessageList } from "@/components/workspace/WorkspaceMessageList";
import { WorkspaceProgressPill, type WorkspaceIdeationInterviewProgressUi } from "@/components/workspace/WorkspaceProgressPill";
import { WorkspaceResultCard } from "@/components/workspace/WorkspaceResultCard";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useWorkspaceScrollToEnd } from "@/components/workspace/useWorkspaceScroll";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";
import { WorkspaceAiHeaderWithAvatar } from "@/components/ai-member/WorkspaceAiHeaderWithAvatar";
import type { WorkspaceAiMemberId } from "@/lib/ai-member/platformAiMembers";
import { displayedWorkspaceAiTitle } from "@/lib/ai-member/visibleAiOrchestrator";
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

function serviceDesignStageBadge(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as { serviceDesignStage?: string };
  const s = String(m.serviceDesignStage ?? "").trim();
  if (s === "feature-planning") return "기능정리";
  if (s === "service-flow") return "액터/흐름";
  if (s === "ideation") return "아이디어";
  return null;
}

function StageBadgePill({ label }: { readonly label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "#0f766e",
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          padding: "2px 8px",
          borderRadius: 999,
          lineHeight: 1.2,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function RequirementsChatPanel({
  messages,
  composer,
  typingIndicator,
  typingIndicatorSpeakerLine,
  typingIndicatorResolvedSpeakerSource,
  ideationInterviewUi,
  onInsertComposerPrompt,
  onInterviewSuggestionPick,
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
  /** typing bubble 표시용 speaker 라인(있으면 screenAiMemberId 기본 타이틀보다 우선) */
  readonly typingIndicatorSpeakerLine?: string | null;
  /** typing bubble speaker 결정 출처(진단용) */
  readonly typingIndicatorResolvedSpeakerSource?: string | null;
  readonly ideationInterviewUi?: WorkspaceIdeationInterviewProgressUi | null;
  readonly onInsertComposerPrompt?: (text: string) => void;
  /** SingleChat 인터뷰 추천 칩 선택 */
  readonly onInterviewSuggestionPick?: (label: string) => void;
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

  const shouldLogSpeakerBinding = useMemo(() => {
    return process.env.NODE_ENV !== "production" || String(process.env.NEXT_PUBLIC_JY_SPEAKER_BIND_LOG ?? "").trim() === "1";
  }, []);

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

  const interviewSecondaryHoverBtn = useMemo(
    () =>
      ({
        ...hoverActionBtn,
        padding: "5px 8px",
        fontSize: 11,
        fontWeight: 600,
        color: "#64748b",
        boxShadow: "none",
        opacity: 0.92,
      }) satisfies CSSProperties,
    [hoverActionBtn]
  );

  const headerActionBtn = useMemo(
    () =>
      ({
        ...interviewSecondaryHoverBtn,
        padding: "4px 8px",
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 999,
        background: "rgba(255,255,255,0.75)",
      }) satisfies CSSProperties,
    [interviewSecondaryHoverBtn]
  );

  const interviewChipBtn = useMemo(
    () =>
      ({
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        borderRadius: 999,
        padding: "8px 12px",
        fontSize: 12.5,
        fontWeight: 700,
        color: "#0f172a",
        cursor: "pointer",
        lineHeight: 1.25,
        maxWidth: "100%",
        textAlign: "left" as const,
      }) satisfies CSSProperties,
    []
  );

  const interviewUi = ideationInterviewUi ?? null;
  /** 아이디어 SingleChat 인터뷰 — 메시지 카드는 대화 위주, 디버그·질문하기 최소화 */
  const interviewMode = Boolean(interviewUi);
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
            const stageBadge = serviceDesignStageBadge(m.meta);
            const tg = getMessageTargets(m);
            const targetLine = formatTargetNamesForUi(m) || (m.targetName ? String(m.targetName) : "");
            const showToMeta =
              mine &&
              targetLine &&
              (tg.length > 1 || tg.some((t) => t.id !== VIRTUAL_AI_PLANNER_ID));
            const replyToId = typeof m.replyTo === "string" && m.replyTo.trim() ? m.replyTo.trim() : null;
            const replied = replyToId ? messageById.get(replyToId) ?? null : null;
            const replies = repliesByParentId.get(m.id) ?? [];
            const timeStr = new Date(m.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

            const compactReplyLabel =
              replyToId && replied
                ? formatSingleChatReplyReferenceLine(replied)
                : replyToId
                  ? "↪ 메시지에 답글"
                  : "";
            const replyContextLine =
              compactReplyLabel ? (
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: t.textMuted,
                    marginBottom: 8,
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={compactReplyLabel}
                >
                  {compactReplyLabel}
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

            const headerActions =
              canReply || true ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {canReply ? (
                    <button
                      type="button"
                      onClick={() => onSetReplyTo?.(m.id, formatSingleChatReplyReferenceLine(m))}
                      style={headerActionBtn}
                      title="이 메시지에 답글"
                    >
                      답글
                    </button>
                  ) : null}
                  <button type="button" onClick={() => void copyToClipboard(normalizeRequirementsMessageText(m.content))} style={headerActionBtn} title="복사">
                    복사
                  </button>
                  {repliesNavBtn}
                </div>
              ) : repliesNavBtn;

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
                  style={{ justifySelf: "end", maxWidth: "78%", width: "fit-content", minWidth: 0, position: "relative" }}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId((cur) => (cur === m.id ? null : cur))}
                >
                  <div style={workspaceStandardChatBubbleShell("user")}>
                    {stageBadge ? <StageBadgePill label={stageBadge} /> : null}
                    {replyContextLine}
                    <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>
                      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                        사용자
                        {showToMeta ? <span style={{ fontWeight: 600, color: t.textMuted }}> · To: {targetLine}</span> : null}
                        <span style={{ fontWeight: 700, color: t.textMuted }}> · {timeStr}</span>
                      </span>
                      {headerActions}
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
                  style={{ justifySelf: "start", maxWidth: "min(100%, 620px)", width: "fit-content", minWidth: 0, position: "relative" }}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId((cur) => (cur === m.id ? null : cur))}
                >
                  <div style={workspaceStandardChatBubbleShell("member")}>
                    {replyContextLine}
                    <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>
                      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                        멤버 · {memberName}
                        <span style={{ fontWeight: 700, color: t.textMuted }}> · {timeStr}</span>
                      </span>
                      {headerActions}
                    </div>
                    <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>{text}</div>
                  </div>
                </div>
              );
            }

            if (m.role === "ai") {
              const text = normalizeRequirementsMessageText(m.content);
              const isErr = m.messageType === "FRIENDLY_ERROR";
              const isInterviewTurn =
                m.speakerId === VIRTUAL_AI_PLANNER_ID &&
                (m.meta?.internalType === IDEATION_PROBLEM_INTERVIEW_TURN_INTERNAL_TYPE ||
                  m.meta?.internalType === IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE);
              const deliverPayload =
                !isErr &&
                m.messageType === "NOTICE" &&
                m.meta?.internalType === IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE
                  ? parseIdeationDeliverableChatPayload(m.content)
                  : null;
              const tone = isErr ? "error" : m.messageType === "NOTICE" ? "notice" : "default";
              const showHoverActions = m.messageType === "ANSWER" && !isErr;
              const interviewSuggestionsRaw = m.meta?.interviewSuggestions;
              const interviewSuggestions =
                Array.isArray(interviewSuggestionsRaw) && interviewSuggestionsRaw.length
                  ? interviewSuggestionsRaw.map((x) => String(x ?? "").trim()).filter(Boolean)
                  : [];
              const showInterviewChips =
                Boolean(onInterviewSuggestionPick) &&
                interviewSuggestions.length > 0 &&
                !deliverPayload &&
                !isErr &&
                isInterviewTurn;
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
              const speakerFromMessage = String(m.speakerName ?? "").trim();
              const aiSpeakerLine = speakerFromMessage || defaultAiTitle;
              const resolvedSpeakerSource = speakerFromMessage ? "message.speakerName" : "screenAiMemberId_fallback";
              if (shouldLogSpeakerBinding) {
                console.debug("[speaker-binding]", {
                  kind: "message",
                  messageId: m.id,
                  resolvedSpeakerSource,
                  speakerLine: aiSpeakerLine,
                  speakerId: m.speakerId ?? null,
                });
              }

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
                    {stageBadge ? <StageBadgePill label={stageBadge} /> : null}
                    {replyContextLine}
                    <div style={WORKSPACE_STANDARD_CHAT_HEADER_STYLE}>
                      <WorkspaceAiHeaderWithAvatar memberId={screenAiMemberId} trailing={headerActions}>
                        {aiSpeakerLine}
                        <span style={{ fontWeight: 700, color: t.textMuted }}> · {timeStr}</span>
                      </WorkspaceAiHeaderWithAvatar>
                    </div>
                    <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>{aiBody}</div>
                    {showInterviewChips ? (
                      <div
                        style={{
                          marginTop: 12,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          alignItems: "center",
                          width: "100%",
                        }}
                        aria-label="답변 힌트(선택 사항)"
                      >
                        {interviewSuggestions.map((label) => (
                          <button
                            key={`${m.id}-${label}`}
                            type="button"
                            onClick={() => onInterviewSuggestionPick?.(label)}
                            style={interviewChipBtn}
                          >
                            {label}
                          </button>
                        ))}
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
                    {String(typingIndicatorSpeakerLine ?? "").trim() || displayedWorkspaceAiTitle(screenAiMemberId)}
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
