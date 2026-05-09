"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { RequirementsMessage } from "@/lib/requirements/requirementsMessage";
import { normalizeRequirementsMessageText } from "@/lib/requirements/requirementsMessageDisplay";
import { formatTargetNamesForUi, getMessageTargets } from "@/lib/requirements/requirementsTargets";
import { VIRTUAL_AI_PLANNER_ID } from "@/lib/project/requirementsRoomState";
import { IDEATION_INTERVIEW_BOOTSTRAP_INTERNAL_TYPE } from "@/lib/requirements/ideationInterviewBootstrap";
import {
  IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE,
  parseIdeationDeliverableChatPayload,
} from "@/lib/requirements/ideationDeliverables";
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

function SvgReplyIcon({ size = 16 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 14L5 10l4-4M5 10h11a4 4 0 0 1 4 4v1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SvgCopyIcon({ size = 16 }: { readonly size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
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
  sessionUserDisplayName = "나",
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
  /** 내 메시지 헤더에 표시할 닉네임(세션 사용자 표시명) */
  readonly sessionUserDisplayName?: string;
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

  /** QuickAction 칩 선택 시 해당 AI 메시지의 답글/복사를 잠시 고정 노출 */
  const [pinnedActionsMessageId, setPinnedActionsMessageId] = useState<string | null>(null);
  const pinnedActionsMessageIdRef = useRef<string | null>(null);
  pinnedActionsMessageIdRef.current = pinnedActionsMessageId;
  const sessionLine = String(sessionUserDisplayName ?? "").trim() || "나";

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.closest("[data-requirements-composer-root]")) {
        setPinnedActionsMessageId(null);
        return;
      }
      const pid = pinnedActionsMessageIdRef.current;
      if (pid && t.closest(`[data-requirements-message-id="${pid}"]`)) return;
      setPinnedActionsMessageId(null);
    };
    document.addEventListener("mousedown", onDocDown, true);
    return () => document.removeEventListener("mousedown", onDocDown, true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!pinnedActionsMessageIdRef.current) return;
      setPinnedActionsMessageId(null);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const iconActionBtn = useMemo(
    () =>
      ({
        width: 34,
        height: 34,
        borderRadius: 999,
        border: "1px solid #e2e8f0",
        background: "rgba(255,255,255,0.96)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#475569",
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
        lineHeight: 0,
      }) satisfies CSSProperties,
    []
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

            const showActions = hoveredId === m.id || pinnedActionsMessageId === m.id;
            const headerCopyBtn = (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void copyToClipboard(normalizeRequirementsMessageText(m.content));
                }}
                style={{ ...iconActionBtn, flexShrink: 0 }}
                title="복사"
                aria-label="메시지 복사"
              >
                <SvgCopyIcon />
              </button>
            );
            const headerRowWithCopy: CSSProperties = {
              ...WORKSPACE_STANDARD_CHAT_HEADER_STYLE,
              width: "100%",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 6,
            };
            const actionIconRow = (align: "start" | "end") =>
              showActions ? (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: align === "end" ? "flex-end" : "flex-start",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                  aria-label="메시지 작업"
                >
                  {canReply ? (
                    <button
                      type="button"
                      onClick={() => onSetReplyTo?.(m.id, formatSingleChatReplyReferenceLine(m))}
                      style={iconActionBtn}
                      title="답글"
                      aria-label="답글"
                    >
                      <SvgReplyIcon />
                    </button>
                  ) : null}
                  {repliesNavBtn}
                </div>
              ) : null;

            if (mine) {
              const text = normalizeRequirementsMessageText(m.content);
              return (
                <div
                  key={m.id}
                  data-requirements-message-root
                  data-requirements-message-id={m.id}
                  ref={(el) => {
                    if (!el) {
                      messageRefs.current.delete(m.id);
                      return;
                    }
                    messageRefs.current.set(m.id, el);
                  }}
                  style={{
                    justifySelf: "end",
                    maxWidth: "min(92%, 680px)",
                    width: "100%",
                    minWidth: 0,
                    position: "relative",
                  }}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId((cur) => (cur === m.id ? null : cur))}
                >
                  <div style={{ ...workspaceStandardChatBubbleShell("user"), width: "100%", maxWidth: "100%" }}>
                    {stageBadge ? <StageBadgePill label={stageBadge} /> : null}
                    {replyContextLine}
                    <div style={headerRowWithCopy}>
                      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                        {sessionLine}
                        {showToMeta ? <span style={{ fontWeight: 600, color: t.textMuted }}> · To: {targetLine}</span> : null}
                        <span style={{ fontWeight: 700, color: t.textMuted }}> · {timeStr}</span>
                      </span>
                      {headerCopyBtn}
                    </div>
                    <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>{text}</div>
                    {actionIconRow("end")}
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
                  data-requirements-message-root
                  data-requirements-message-id={m.id}
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
                    <div style={headerRowWithCopy}>
                      <span style={{ flex: "1 1 auto", minWidth: 0 }}>
                        멤버 · {memberName}
                        <span style={{ fontWeight: 700, color: t.textMuted }}> · {timeStr}</span>
                      </span>
                      {headerCopyBtn}
                    </div>
                    <div style={WORKSPACE_STANDARD_CHAT_BODY_STYLE}>{text}</div>
                    {actionIconRow("start")}
                  </div>
                </div>
              );
            }

            if (m.role === "ai") {
              const text = normalizeRequirementsMessageText(m.content);
              const isErr = m.messageType === "FRIENDLY_ERROR";
              const deliverPayload =
                !isErr &&
                m.messageType === "NOTICE" &&
                m.meta?.internalType === IDEATION_DELIVERABLE_RESULT_INTERNAL_TYPE
                  ? parseIdeationDeliverableChatPayload(m.content)
                  : null;
              const tone = isErr ? "error" : m.messageType === "NOTICE" ? "notice" : "default";
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
                // 기존 인터뷰 턴뿐 아니라, 모든 AI 응답에 quick action chip을 허용한다.
                true;
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
                  data-requirements-message-root
                  data-requirements-message-id={m.id}
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
                    <div style={headerRowWithCopy}>
                      <WorkspaceAiHeaderWithAvatar memberId={screenAiMemberId} trailing={headerCopyBtn}>
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
                            onClick={() => {
                              setPinnedActionsMessageId(m.id);
                              onInterviewSuggestionPick?.(label);
                            }}
                            style={interviewChipBtn}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {actionIconRow("start")}
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
      footer={
        <div data-requirements-composer-root>
          <WorkspaceComposerFooter>{composer}</WorkspaceComposerFooter>
        </div>
      }
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
