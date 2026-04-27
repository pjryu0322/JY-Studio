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
  interviewSlotLevelFromState,
  problemInterviewSlotLabelKr,
  type ProblemInterviewSlot,
  type ProblemInterviewState,
} from "@/lib/requirements/problemInterview";
import { RequirementsDeliverableChatCard } from "@/components/requirements/RequirementsDeliverableChatCard";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { RequirementsAiMessageMarkdown } from "@/components/requirements/RequirementsAiMessageMarkdown";
import { displayedAiOrchestrator, showInternalAgents } from "@/lib/ai-member/visibleAiOrchestrator";

function roleLabel(role: RequirementsMessage["role"]): string {
  if (role === "user") return "나";
  if (role === "ai") return "AI";
  if (role === "human") return "멤버";
  return "시스템";
}

const userBubble = {
  maxWidth: "min(100%, 520px)",
  marginLeft: "auto" as const,
  marginRight: 0,
  padding: "14px 16px",
  borderRadius: "18px 18px 6px 18px",
  background: "linear-gradient(180deg, #0f766e 0%, #0d5c56 100%)",
  color: "#fff",
  border: "none",
  fontSize: 15,
  lineHeight: 1.55,
  boxShadow: "0 10px 28px -14px rgba(13, 92, 86, 0.45)",
  whiteSpace: "pre-wrap" as const,
};

const humanBubble = {
  maxWidth: "min(100%, 560px)",
  marginLeft: 0,
  marginRight: "auto" as const,
  padding: "14px 16px",
  borderRadius: "18px 18px 18px 6px",
  background: "#fff",
  color: "#0f172a",
  border: "1px solid #e2e8f0",
  fontSize: 15,
  lineHeight: 1.55,
  boxShadow: "0 8px 24px -16px rgba(15, 23, 42, 0.12)",
  whiteSpace: "pre-wrap" as const,
};

function aiCardShell(tone: "default" | "notice" | "error") {
  const border =
    tone === "error" ? "1px solid #fecaca" : tone === "notice" ? "1px solid #bae6fd" : "1px solid #e2e8f0";
  const bg = tone === "error" ? "#fef2f2" : tone === "notice" ? "#f0f9ff" : "#ffffff";
  return {
    maxWidth: "min(100%, 640px)",
    marginLeft: 0,
    marginRight: "auto" as const,
    borderRadius: 14,
    border,
    background: bg,
    boxShadow: "0 8px 28px -18px rgba(15, 23, 42, 0.14)",
    overflow: "hidden" as const,
  };
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
  expandControls,
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
  /** 채팅 영역 확대/축소(아이디어 구체화 등) */
  readonly expandControls?: { expanded: boolean; onToggle: () => void } | null;
}) {
  const showScreenLabels = useShowScreenLabels();
  const endRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    const t = window.requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(t);
  }, [messages, typingIndicator]);

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

  const threadWrapStyle = useCallback(
    (mine: boolean): CSSProperties => ({
      position: "relative",
      marginLeft: mine ? 0 : 18,
      marginRight: mine ? 18 : 0,
      paddingLeft: mine ? 0 : 12,
      paddingRight: mine ? 12 : 0,
    }),
    []
  );

  const threadLineStyle = useCallback(
    (mine: boolean): CSSProperties => ({
      position: "absolute",
      top: 2,
      bottom: 2,
      left: mine ? undefined : 2,
      right: mine ? 2 : undefined,
      width: 2,
      borderRadius: 999,
      background: "linear-gradient(180deg, rgba(148,163,184,0.05) 0%, rgba(148,163,184,0.45) 40%, rgba(148,163,184,0.05) 100%)",
    }),
    []
  );

  const threadLabelStyle = useMemo(
    () =>
      ({
        fontSize: 11,
        fontWeight: 900,
        color: "#64748b",
        letterSpacing: "0.02em",
        marginBottom: 6,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }) satisfies CSSProperties,
    []
  );

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

  const expanded = Boolean(expandControls?.expanded);
  const interviewUi = ideationInterviewUi ?? null;
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [slotDetailsOpen, setSlotDetailsOpen] = useState(false);

  useEffect(() => {
    if (!popoverOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setPopoverOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popoverOpen]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (headerRef.current?.contains(t)) return;
      setPopoverOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [popoverOpen]);

  const ExpandIcon = useCallback(({ expanded }: { expanded: boolean }) => {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        {expanded ? (
          <>
            <path d="M9 3H5a2 2 0 0 0-2 2v4" />
            <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
            <path d="M3 9l7-7" />
            <path d="M21 15l-7 7" />
          </>
        ) : (
          <>
            <path d="M15 3h4a2 2 0 0 1 2 2v4" />
            <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
            <path d="M21 9l-7-7" />
            <path d="M3 15l7 7" />
          </>
        )}
      </svg>
    );
  }, []);

  return (
    <section
      data-testid="requirements-chat-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        flex: "1 1 auto",
        height: "100%",
        minHeight: expanded ? 640 : 0,
        minWidth: 280,
        maxWidth: "100%",
        overflow: "hidden",
      }}
      aria-label="아이디어 구체화 채팅"
    >
      {expandControls || interviewUi ? (
        <div
          ref={headerRef}
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 12px",
            borderBottom: "1px solid #e2e8f0",
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {interviewUi ? (
              <div style={{ position: "relative", minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => setPopoverOpen((v) => !v)}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 12,
                    fontWeight: 900,
                    color: "#0f172a",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    maxWidth: "min(100%, 360px)",
                  }}
                  title="아이디어 정리도 상세 보기"
                >
                  <span style={{ whiteSpace: "nowrap" }}>아이디어 정리도 {interviewUi.readinessPercent}%</span>
                  <span style={{ color: "#94a3b8", fontWeight: 900 }}>·</span>
                  <span style={{ whiteSpace: "nowrap", color: "#334155" }}>
                    {interviewUi.covered}/{interviewUi.total}
                  </span>
                </button>

                {popoverOpen ? (
                  <div
                    role="dialog"
                    aria-label="아이디어 정리도 상세"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "calc(100% + 8px)",
                      zIndex: 6,
                      width: "min(92vw, 520px)",
                      borderRadius: 14,
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      boxShadow: "0 24px 64px -28px rgba(15, 23, 42, 0.35)",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                      <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>
                        아이디어 정리도 {interviewUi.readinessPercent}% · {interviewUi.covered}/{interviewUi.total}
                      </div>
                      <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: "#e2e8f0", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${Math.min(100, Math.max(0, interviewUi.readinessPercent))}%`,
                            height: "100%",
                            borderRadius: 999,
                            background: "#0f766e",
                            transition: "width 0.25s ease-out",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: "#334155" }}>
                          확보 슬롯: {interviewUi.covered}/{interviewUi.total}
                        </div>
                        {interviewUi.nextSlot ? (
                          <div style={{ fontSize: 12, fontWeight: 900, color: "#0f766e" }}>
                            다음 필요 정보: {problemInterviewSlotLabelKr(interviewUi.nextSlot)}
                          </div>
                        ) : null}
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b" }}>
                          예상 남은 질문: {Math.max(0, interviewUi.remainingQuestionsEstimate)}개
                        </div>
                      </div>

                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setSlotDetailsOpen((v) => !v)}
                          style={{
                            border: "1px solid #e2e8f0",
                            background: "#fff",
                            borderRadius: 10,
                            padding: "8px 10px",
                            fontSize: 12,
                            fontWeight: 900,
                            color: "#334155",
                            cursor: "pointer",
                          }}
                        >
                          슬롯 상세 {slotDetailsOpen ? "접기" : "보기"}
                        </button>
                        <button
                          type="button"
                          onClick={() => interviewUi.onForceGeneratePlanNow()}
                          style={{
                            border: "1px solid #0f766e",
                            background: "#ecfdf5",
                            borderRadius: 10,
                            padding: "8px 10px",
                            fontSize: 12,
                            fontWeight: 900,
                            color: "#065f46",
                            cursor: "pointer",
                          }}
                        >
                          지금까지 내용으로 기획안 만들기
                        </button>
                      </div>

                      {slotDetailsOpen ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>표시:</span>
                            <span style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>✔ 완료</span>
                            <span style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>△ 부분</span>
                            <span style={{ fontSize: 12, fontWeight: 900, color: "#0f172a" }}>□ 미확보</span>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                            {PROBLEM_INTERVIEW_SLOTS.map((slot) => {
                              const level = interviewUi.slotState ? interviewSlotLevelFromState(interviewUi.slotState, slot) : "empty";
                              const icon = level === "filled" ? "✔" : level === "partial" ? "△" : "□";
                              const color =
                                level === "filled" ? "#065f46" : level === "partial" ? "#92400e" : "#475569";
                              const bg =
                                level === "filled" ? "#ecfdf5" : level === "partial" ? "#fffbeb" : "#f8fafc";
                              const border =
                                level === "filled" ? "1px solid #a7f3d0" : level === "partial" ? "1px solid #fde68a" : "1px solid #e2e8f0";
                              return (
                                <div
                                  key={slot}
                                  style={{
                                    border,
                                    background: bg,
                                    borderRadius: 12,
                                    padding: "8px 10px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                  }}
                                >
                                  <span style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>{problemInterviewSlotLabelKr(slot)}</span>
                                  <span style={{ fontSize: 12, fontWeight: 900, color }}>{icon}</span>
                                </div>
                              );
                            })}
                          </div>
                          {interviewUi.recentAskedSlots.length ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 900, color: "#64748b" }}>최근 질문:</span>
                              {interviewUi.recentAskedSlots.slice(-6).map((s, idx) => (
                                <span
                                  key={`${s}-${idx}`}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 900,
                                    color: "#334155",
                                    background: "#fff",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: 999,
                                    padding: "3px 8px",
                                  }}
                                >
                                  {problemInterviewSlotLabelKr(s)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {expandControls ? (
            <button
              type="button"
              data-testid="requirements-chat-expand-toggle"
              onClick={() => expandControls.onToggle()}
              aria-label={expanded ? "채팅 축소" : "채팅 확대"}
              title={expanded ? "채팅 축소" : "채팅 확대"}
              style={{
                border: "1px solid #cbd5e1",
                background: expanded ? "#f0fdfa" : "#fff",
                borderRadius: 10,
                width: 36,
                height: 36,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#0f172a",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <ExpandIcon expanded={expanded} />
            </button>
          ) : null}
        </div>
      ) : null}
      <div
        className="relative"
        style={{
          position: "relative",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "18px 18px 12px",
            background: "linear-gradient(180deg, #f1f5f9 0%, #eef2f7 50%, #f8fafc 100%)",
          }}
        >
        <ScreenLabel label="요구사항-채팅영역-메시지타임라인" visible={showScreenLabels} />
        {firstIsOnboarding ? <ScreenLabel label="요구사항-채팅영역-초기안내메시지" visible={showScreenLabels} /> : null}

        <div style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
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
            const meta = (
              <div
                style={{
                  fontSize: 11,
                  color: "#71717a",
                  paddingLeft: mine ? 0 : 4,
                  paddingRight: mine ? 4 : 0,
                  textAlign: mine ? "right" : "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: mine ? "flex-end" : "flex-start",
                  gap: 8,
                }}
              >
                <span>
                  {roleLabel(m.role)}
                  {m.speakerName || m.role === "ai"
                    ? ` · ${
                        m.role === "ai" && !showInternalAgents ? displayedAiOrchestrator().name : String(m.speakerName ?? "").trim()
                      }`
                    : ""}{" "}
                  ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  {showToMeta ? (
                    <span style={{ fontWeight: 600, color: "#94a3b8" }}> · To: {targetLine}</span>
                  ) : null}
                </span>
                {replies.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => scrollToNextReply(m.id)}
                    style={repliesBadgeStyle}
                    title="답글로 이동(클릭마다 다음 답글 순환)"
                  >
                    답글 {replies.length}
                  </button>
                ) : null}
              </div>
            );

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
                  style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {replyToId ? (
                    <div style={threadWrapStyle(true)}>
                      <div aria-hidden style={threadLineStyle(true)} />
                      <div style={threadLabelStyle} title={replyToId}>
                        <span>↪ 답글</span>
                        {replied ? (
                          <span style={{ fontWeight: 700, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {replied.speakerName ? `${replied.speakerName} · ` : ""}
                            {replyPreview || replyToId}
                          </span>
                        ) : (
                          <span style={{ fontWeight: 700, color: "#94a3b8" }}>{replyToId}</span>
                        )}
                      </div>
                    </div>
                  ) : null}
                  {replyToId ? (
                    <div style={threadWrapStyle(true)}>
                      <div aria-hidden style={threadLineStyle(true)} />
                      <div style={userBubble}>{text}</div>
                    </div>
                  ) : (
                    <div style={userBubble}>{text}</div>
                  )}
                  {meta}
                </div>
              );
            }

            if (m.role === "human") {
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
                  style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {meta}
                  {replyToId ? (
                    <div style={threadWrapStyle(false)}>
                      <div aria-hidden style={threadLineStyle(false)} />
                      <div style={threadLabelStyle} title={replyToId}>
                        <span>↪ 답글</span>
                        {replied ? (
                          <span style={{ fontWeight: 700, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {replied.speakerName ? `${replied.speakerName} · ` : ""}
                            {replyPreview || replyToId}
                          </span>
                        ) : (
                          <span style={{ fontWeight: 700, color: "#94a3b8" }}>{replyToId}</span>
                        )}
                      </div>
                      <div style={humanBubble}>{text}</div>
                    </div>
                  ) : (
                    <div style={humanBubble}>{text}</div>
                  )}
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
                      margin: "10px 14px 0",
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
                <RequirementsDeliverableChatCard
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
                  style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {meta}
                  {replyToId ? (
                    <div style={threadWrapStyle(false)}>
                      <div aria-hidden style={threadLineStyle(false)} />
                      <div style={threadLabelStyle} title={replyToId}>
                        <span>↪ 답글</span>
                        {replied ? (
                          <span style={{ fontWeight: 700, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {replied.speakerName ? `${replied.speakerName} · ` : ""}
                            {replyPreview || replyToId}
                          </span>
                        ) : (
                          <span style={{ fontWeight: 700, color: "#94a3b8" }}>{replyToId}</span>
                        )}
                      </div>
                      <div
                        style={{ ...aiCardShell(tone), position: "relative" }}
                        onMouseEnter={() => setHoveredId(m.id)}
                        onMouseLeave={() => setHoveredId((cur) => (cur === m.id ? null : cur))}
                      >
                        {interviewPurposeBadge}
                        <div style={{ padding: "12px 14px 14px", fontSize: 15, color: "#0f172a" }}>{aiBody}</div>
                        {showHoverActions && hoveredId === m.id ? (
                          <div
                            style={{
                              position: "absolute",
                              right: 10,
                              top: 10,
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
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
                  ) : (
                    <div
                      style={{ ...aiCardShell(tone), position: "relative" }}
                      onMouseEnter={() => setHoveredId(m.id)}
                      onMouseLeave={() => setHoveredId((cur) => (cur === m.id ? null : cur))}
                    >
                      {interviewPurposeBadge}
                      <div style={{ padding: "12px 14px 14px", fontSize: 15, color: "#0f172a" }}>{aiBody}</div>
                    {showHoverActions && hoveredId === m.id ? (
                      <div
                        style={{
                          position: "absolute",
                          right: 10,
                          top: 10,
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
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
                  )}
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
                style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}
              >
                {meta}
                <div style={aiCardShell(isErr ? "error" : "notice")}>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid rgba(148, 163, 184, 0.35)",
                      background: isErr ? "#fee2e2" : "#f1f5f9",
                      fontSize: 12,
                      fontWeight: 800,
                      color: isErr ? "#991b1b" : "#475569",
                    }}
                  >
                    시스템
                  </div>
                  <div style={{ padding: "12px 14px 14px", fontSize: 15 }}>
                    <RequirementsAiMessageMarkdown text={text} variant={isErr ? "error" : "default"} />
                  </div>
                </div>
              </div>
            );
          })}

          {typingIndicator ? (
            <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 11, color: "#71717a", paddingLeft: 4, textAlign: "left" }}>
                AI · AI 기획자 · {new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div style={aiCardShell("notice")}>
                <div style={{ padding: "14px 16px", fontSize: 15, color: "#0f172a" }}>
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
          <div ref={endRef} />
        </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "10px 18px 0",
            borderTop: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          {composer}
        </div>
      </div>
    </section>
  );
}
