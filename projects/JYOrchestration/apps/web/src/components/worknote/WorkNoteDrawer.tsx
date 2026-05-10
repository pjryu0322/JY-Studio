"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WorkNoteListItem, WorkNoteSaveState } from "@/hooks/useWorkNotesPanel";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import { uiTokens as t } from "@/components/ui/tokens";
import { insertWorkNoteImageAtCaret } from "@/components/worknote/workNoteDrawerInsertImage";
import {
  readWorkNotePanelStoredGeom,
  readWorkNotePanelStoredOpacity,
  type WorkNotePanelGeom,
  workNotePanelClamp,
  workNotePanelDefaultGeom,
  writeWorkNotePanelStoredGeom,
  writeWorkNotePanelStoredOpacity,
} from "@/components/worknote/workNoteDrawerPanelStorage";
import {
  workNoteMemoDisplayTitle,
  workNoteMemoSwatchColors,
  workNotePlainTextFromSelectionWithinEditor,
  workNoteSaveStateLabel,
} from "@/components/worknote/workNoteDrawerUiHelpers";
import { escapeHtmlText, imageFileToJpegDataUrl, noteRawToEditorHtml } from "@/lib/worknote/workNoteEditorHtml";
import { workNoteHtmlToPlainForSummary } from "@/lib/worknote/workNoteHtmlPlain";
import { postWorkNoteSummarize } from "@/lib/worknote/workNotesSummarizeApi";

type PanelGeom = WorkNotePanelGeom;

type WorkNoteAiInsight = {
  readonly summary: string;
  readonly requestType: string;
  readonly priority: string;
  readonly priorityReason?: string;
};

export function WorkNoteDrawer(p: {
  /** `page`: 본문 영역 전체(고정 레이어·드래그 없음). 기본 `drawer`는 기존 플로팅 패널 */
  readonly variant?: "drawer" | "page";
  readonly activeMemoScope: "USER" | "PROJECT";
  /** PROJECT 요약 시에만 사용 */
  readonly activeProjectId: string | null;
  readonly memoBadgeKind: "USER" | "PROJECT";
  readonly memoBadgeSubtitle: string;
  readonly showMemoTabs?: boolean;
  readonly memoTab?: "USER" | "PROJECT";
  readonly onMemoTabChange?: (tab: "USER" | "PROJECT") => void;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly listLoading: boolean;
  readonly listError: string | null;
  readonly notes: readonly WorkNoteListItem[];
  readonly activeId: string | null;
  readonly selectNote: (id: string) => void;
  readonly createNote: () => void;
  readonly deleteNote: (id: string) => void;
  readonly title: string;
  readonly setTitle: (next: string) => void;
  readonly text: string;
  readonly onChangeText: (next: string) => void;
  readonly editorHydrated: boolean;
  readonly saveState: WorkNoteSaveState;
  readonly saveError: string | null;
  readonly onShareToComposer?: (text: string) => void;
}) {
  const isPage = p.variant === "page";
  const isNarrow = useMediaQuery("(max-width: 720px)");
  const panelRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const lastEditorActiveIdRef = useRef<string | null>(null);
  const dragRef = useRef<{ kind: "move" | "resize"; sx: number; sy: number; g: PanelGeom } | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<{ left: number; top: number; text: string } | null>(null);
  const [railHoverId, setRailHoverId] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<WorkNoteAiInsight | null>(null);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);
  const [aiSummarizing, setAiSummarizing] = useState(false);

  const [geom, setGeom] = useState<PanelGeom | null>(null);
  const [panelOpacity, setPanelOpacity] = useState(1);
  const geomRef = useRef<PanelGeom | null>(null);

  useLayoutEffect(() => {
    if (isPage) return;
    if (!p.open) {
      lastEditorActiveIdRef.current = null;
      return;
    }
    if (isNarrow) {
      setGeom(workNotePanelDefaultGeom(true));
    } else {
      setGeom((prev) => prev ?? readWorkNotePanelStoredGeom() ?? workNotePanelDefaultGeom(false));
    }
    setPanelOpacity(readWorkNotePanelStoredOpacity());
  }, [isPage, p.open, isNarrow]);

  useEffect(() => {
    if (geom) geomRef.current = geom;
  }, [geom]);

  useEffect(() => {
    setAiInsight(null);
    setAiSummaryError(null);
    setAiSummarizing(false);
  }, [p.activeId, p.memoBadgeKind]);

  const handleSelectNote = useCallback(
    async (id: string) => {
      await p.selectNote(id);
    },
    [p]
  );

  const handleCreateNote = useCallback(async () => {
    await p.createNote();
  }, [p]);

  useLayoutEffect(() => {
    if (!p.open || !p.editorHydrated || !editorRef.current) return;
    if (!p.activeId) {
      editorRef.current.innerHTML = "";
      lastEditorActiveIdRef.current = null;
      return;
    }
    if (lastEditorActiveIdRef.current !== p.activeId) {
      lastEditorActiveIdRef.current = p.activeId;
      editorRef.current.innerHTML = noteRawToEditorHtml(p.text);
    }
  }, [p.open, p.editorHydrated, p.activeId, p.text]);

  const onChangeText = p.onChangeText;
  const syncFromEditor = useCallback(() => {
    const el = editorRef.current;
    onChangeText(el?.innerHTML ?? "");
  }, [onChangeText]);

  const requestAiSummary = useCallback(async () => {
    if (!p.activeId || !p.editorHydrated) return;
    const html = editorRef.current?.innerHTML ?? p.text;
    const plain = workNoteHtmlToPlainForSummary(html, 120_000);
    if (!plain.trim()) {
      setAiSummaryError("요약할 내용이 없습니다.");
      setAiInsight(null);
      return;
    }
    setAiSummarizing(true);
    setAiSummaryError(null);
    setAiInsight(null);
    try {
      const wire = await postWorkNoteSummarize(
        p.activeMemoScope === "USER"
          ? { scope: "user", contentHtml: html }
          : { projectId: String(p.activeProjectId ?? "").trim(), contentHtml: html }
      );
      setAiInsight({
        summary: wire.summary,
        requestType: wire.requestType,
        priority: wire.priority,
        ...(wire.priorityReason.trim() ? { priorityReason: wire.priorityReason.trim() } : {}),
      });
    } catch (e) {
      setAiSummaryError(e instanceof Error ? e.message : "요약 요청 중 오류가 발생했습니다.");
    } finally {
      setAiSummarizing(false);
    }
  }, [p.activeId, p.activeMemoScope, p.activeProjectId, p.editorHydrated, p.text]);

  const applyAiSummaryToEditor = useCallback(() => {
    const insight = aiInsight;
    if (!insight) return;
    const s = insight.summary.trim();
    const el = editorRef.current;
    if (!s || !el || !p.activeId) return;
    const escaped = escapeHtmlText(s).replace(/\n/g, "<br/>");
    const metaLines = [
      `요청 분류: ${escapeHtmlText(insight.requestType)}`,
      `우선순위 추천: ${escapeHtmlText(insight.priority)}`,
      ...(insight.priorityReason ? [`근거: ${escapeHtmlText(insight.priorityReason)}`] : []),
    ]
      .map((line) => line.replace(/\n/g, "<br/>"))
      .join("<br/>");
    const block = `<div style="margin:14px 0 0;padding:12px 14px;border-radius:12px;border:1px solid #99f6e4;background:#f0fdfa;font-size:14px;line-height:1.6;color:#0f172a"><div style="font-weight:900;color:#0f766e;margin-bottom:8px">AI 요약</div><div>${escaped}</div><div style="margin-top:10px;font-size:13px;color:#334155">${metaLines}</div></div>`;
    const cur = el.innerHTML.trim();
    const empty = !cur || cur === "<br>" || cur === "<div><br></div>";
    el.innerHTML = empty ? block : `${cur}<br/>${block}`;
    syncFromEditor();
    setAiInsight(null);
    setAiSummaryError(null);
  }, [aiInsight, p.activeId, syncFromEditor]);

  const onCloseRef = useRef(p.onClose);
  useLayoutEffect(() => {
    onCloseRef.current = p.onClose;
  }, [p.onClose]);

  useEffect(() => {
    if (isPage || !p.open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (panelRef.current?.contains(t)) return;
      if ((e.target as HTMLElement).closest?.("[data-testid='work-note-open']")) return;
      onCloseRef.current();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [isPage, p.open]);

  const startMove = useCallback(
    (e: React.PointerEvent) => {
      if (isNarrow) return;
      if (!geom) return;
      e.preventDefault();
      dragRef.current = { kind: "move", sx: e.clientX, sy: e.clientY, g: { ...geom } };
      const move = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = ev.clientX - d.sx;
        const dy = ev.clientY - d.sy;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const next: PanelGeom =
          d.kind === "move"
            ? {
                ...d.g,
                x: workNotePanelClamp(d.g.x + dx, 8, vw - d.g.w - 8),
                y: workNotePanelClamp(d.g.y + dy, 8, vh - d.g.h - 8),
              }
            : {
                ...d.g,
                w: workNotePanelClamp(d.g.w + dx, 300, vw - d.g.x - 8),
                h: workNotePanelClamp(d.g.h + dy, 220, vh - d.g.y - 8),
              };
        geomRef.current = next;
        setGeom(next);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        dragRef.current = null;
        if (geomRef.current) writeWorkNotePanelStoredGeom(geomRef.current);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [geom, isNarrow]
  );

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      if (isNarrow) return;
      e.preventDefault();
      e.stopPropagation();
      if (!geom) return;
      dragRef.current = { kind: "resize", sx: e.clientX, sy: e.clientY, g: { ...geom } };
      const move = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dx = ev.clientX - d.sx;
        const dy = ev.clientY - d.sy;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const next: PanelGeom = {
          ...d.g,
          w: workNotePanelClamp(d.g.w + dx, 300, vw - d.g.x - 8),
          h: workNotePanelClamp(d.g.h + dy, 220, vh - d.g.y - 8),
        };
        geomRef.current = next;
        setGeom(next);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        dragRef.current = null;
        if (geomRef.current) writeWorkNotePanelStoredGeom(geomRef.current);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [geom, isNarrow]
  );

  const updateSelectionBubbleFromEditor = useCallback(() => {
    const root = editorRef.current;
    if (!root || !p.activeId || !p.editorHydrated) {
      setSelectionBubble(null);
      return;
    }
    const text = workNotePlainTextFromSelectionWithinEditor(root);
    if (!text) {
      setSelectionBubble(null);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setSelectionBubble(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      setSelectionBubble(null);
      return;
    }
    const rects = range.getClientRects();
    if (rects.length === 0) return;
    const last = rects[rects.length - 1];
    const centerX = (last.left + last.right) / 2;
    const top = last.bottom + 8;
    setSelectionBubble({ left: centerX, top, text });
  }, [p.activeId, p.editorHydrated]);

  const onEditorSelectEnd = useCallback(() => {
    window.requestAnimationFrame(() => {
      updateSelectionBubbleFromEditor();
    });
  }, [updateSelectionBubbleFromEditor]);

  useEffect(() => {
    setSelectionBubble(null);
  }, [p.activeId, p.open]);

  useEffect(() => {
    if (!selectionBubble) return;
    const dismissIfOutsideBubble = (t: Node | null) => {
      if (!t) return;
      if (bubbleRef.current?.contains(t)) return;
      if (editorRef.current?.contains(t)) {
        setSelectionBubble(null);
        return;
      }
      setSelectionBubble(null);
    };
    const onDown = (e: MouseEvent) => dismissIfOutsideBubble(e.target as Node | null);
    const onTouch = (e: TouchEvent) => dismissIfOutsideBubble(e.target as Node | null);
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("touchstart", onTouch, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("touchstart", onTouch, true);
    };
  }, [selectionBubble]);

  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selectionBubble) {
        setSelectionBubble(null);
        return;
      }
      if (!isPage) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isPage, p.open, selectionBubble]);

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const cd = e.clipboardData;
      if (!cd) return;
      for (const it of Array.from(cd.items ?? [])) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          e.preventDefault();
          const f = it.getAsFile();
          if (!f) return;
          void (async () => {
            try {
              const dataUrl = await imageFileToJpegDataUrl(f, 900);
              if (editorRef.current) insertWorkNoteImageAtCaret(editorRef.current, dataUrl);
              syncFromEditor();
            } catch {
              /* ignore */
            }
          })();
          return;
        }
      }
      if (cd.files?.length) {
        for (const f of Array.from(cd.files)) {
          if (f.type.startsWith("image/")) {
            e.preventDefault();
            void (async () => {
              try {
                const dataUrl = await imageFileToJpegDataUrl(f, 900);
                if (editorRef.current) insertWorkNoteImageAtCaret(editorRef.current, dataUrl);
                syncFromEditor();
              } catch {
                /* ignore */
              }
            })();
            return;
          }
        }
      }
    },
    [syncFromEditor]
  );

  if (!p.open) return null;
  if (!isPage && geom === null) return null;

  const bubbleLeftClamped =
    typeof window !== "undefined" && selectionBubble
      ? Math.max(16, Math.min(selectionBubble.left, window.innerWidth - 16))
      : selectionBubble?.left ?? 0;

  const pagePanelStyle = {
    position: "relative" as const,
    flex: "1 1 auto",
    minHeight: 0,
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    zIndex: "auto" as const,
    background: t.bgCard,
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    opacity: 1,
    display: "flex",
    flexDirection: "column" as const,
    boxSizing: "border-box" as const,
    overflow: "hidden",
    paddingBottom: isNarrow ? "calc(4px + env(safe-area-inset-bottom, 0px))" : undefined,
  };

  const panelStyle = isPage
    ? pagePanelStyle
    : {
        position: "fixed" as const,
        left: geom!.x,
        top: geom!.y,
        width: geom!.w,
        height: geom!.h,
        maxWidth: isNarrow ? "100%" : undefined,
        zIndex: 89,
        background: t.bgCard,
        border: `1px solid ${t.border}`,
        borderRadius: isNarrow ? "16px 16px 0 0" : 14,
        boxShadow: "0 16px 48px rgba(15, 23, 42, 0.18)",
        opacity: panelOpacity,
        display: "flex",
        flexDirection: "column" as const,
        minHeight: 0,
        boxSizing: "border-box" as const,
        overflow: "hidden",
        paddingBottom: isNarrow ? "calc(4px + env(safe-area-inset-bottom, 0px))" : undefined,
      };

  return (
    <>
      {!isPage && isNarrow ? (
        <button
          type="button"
          aria-label="메모 닫기"
          onClick={() => p.onClose()}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 88,
            border: 0,
            padding: 0,
            margin: 0,
            background: t.overlayScrim,
            cursor: "pointer",
          }}
        />
      ) : null}
      <div
        ref={panelRef}
        data-work-note-panel
        role="dialog"
        aria-modal={isNarrow && !isPage}
        aria-label="메모"
        style={panelStyle}
      >
        {isPage ? null : isNarrow ? (
          <div
            style={{
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
              padding: "10px 12px",
              borderBottom: `1px solid ${t.border}`,
              userSelect: "none",
            }}
          >
            <button
              type="button"
              onClick={() => p.onClose()}
              aria-label="닫기"
              style={{
                border: `1px solid ${t.border}`,
                background: "#fff",
                borderRadius: 10,
                width: 36,
                height: 36,
                fontSize: 18,
                lineHeight: 1,
                fontWeight: 800,
                color: t.textSecondary,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
        ) : (
          <div
            onPointerDown={startMove}
            aria-label="메모 패널 위치 이동"
            title="드래그해 위치 이동 · Esc로 닫기"
            style={{
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 12px",
              borderBottom: `1px solid ${t.border}`,
              cursor: "grab",
              userSelect: "none",
              touchAction: "none",
            }}
          >
            <span style={{ flex: "1 1 auto", minHeight: 8, minWidth: 0 }} aria-hidden />
          </div>
        )}

      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          flexDirection: isNarrow ? "column" : "row",
          overflow: "hidden",
        }}
      >
        <aside
          aria-label="메모 목록"
          style={{
            flex: isNarrow ? "0 0 auto" : "0 0 52px",
            width: isNarrow ? "100%" : 52,
            minWidth: isNarrow ? undefined : 52,
            maxWidth: isNarrow ? undefined : 52,
            maxHeight: isNarrow ? 56 : "none",
            minHeight: isNarrow ? 48 : undefined,
            overflowY: "hidden",
            overflowX: isNarrow ? "auto" : "hidden",
            borderBottom: isNarrow ? `1px solid ${t.border}` : "none",
            borderRight: isNarrow ? "none" : `1px solid ${t.border}`,
            padding: 6,
            display: "flex",
            flexDirection: isNarrow ? "row" : "column",
            gap: 6,
            alignItems: isNarrow ? "center" : "stretch",
            boxSizing: "border-box",
          }}
        >
          <button
            type="button"
            onClick={() => void handleCreateNote()}
            disabled={!p.editorHydrated || p.listLoading}
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              padding: 0,
              borderRadius: 10,
              border: `1px dashed ${t.primary}`,
              background: `${t.primary}14`,
              color: t.primary,
              fontSize: 18,
              fontWeight: 900,
              cursor: p.listLoading ? "not-allowed" : "pointer",
              opacity: p.listLoading ? 0.55 : 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="+ 새 메모"
            aria-label="새 메모"
          >
            +
          </button>
          <div
            style={{
              display: "flex",
              flexDirection: isNarrow ? "row" : "column",
              gap: 6,
              minHeight: 0,
              flex: "1 1 auto",
              overflow: "hidden",
              alignItems: isNarrow ? "center" : "center",
              width: "100%",
            }}
          >
            {p.notes.map((n) => {
              const active = n.id === p.activeId;
              const label = workNoteMemoDisplayTitle(n.title);
              const showDelete = railHoverId === n.id || (isNarrow && active);
              const sw = workNoteMemoSwatchColors(n.id, active);
              return (
                <div
                  key={n.id}
                  style={{
                    position: "relative",
                    display: "flex",
                    justifyContent: "center",
                    width: isNarrow ? "auto" : "100%",
                    flexShrink: 0,
                  }}
                  onMouseEnter={() => setRailHoverId(n.id)}
                  onMouseLeave={() => setRailHoverId((cur) => (cur === n.id ? null : cur))}
                >
                  <button
                    type="button"
                    onClick={() => void handleSelectNote(n.id)}
                    title={label}
                    aria-label={label}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      borderStyle: "solid",
                      borderWidth: active ? 3 : 2,
                      borderColor: sw.borderColor,
                      background: sw.background,
                      cursor: "pointer",
                      flexShrink: 0,
                      padding: 0,
                      boxSizing: "border-box",
                    }}
                  />
                  {showDelete ? (
                    <button
                      type="button"
                      aria-label={`${label} 삭제`}
                      title="삭제"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("이 메모를 삭제할까요?")) void p.deleteNote(n.id);
                      }}
                      style={{
                        position: "absolute",
                        top: -4,
                        right: -2,
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: `1px solid ${t.border}`,
                        background: "#fff",
                        color: t.textMuted,
                        cursor: "pointer",
                        fontSize: 13,
                        lineHeight: 1,
                        padding: 0,
                        boxShadow: "0 2px 8px rgba(15,23,42,0.12)",
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <div
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            padding: "8px 12px 10px",
            gap: 8,
          }}
        >
          {p.listLoading ? (
            <div style={{ fontSize: 12, fontWeight: 700, color: t.textMuted }}>불러오는 중…</div>
          ) : null}
          {p.listError ? (
            <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>{p.listError}</div>
          ) : null}

          {p.showMemoTabs && p.memoTab && p.onMemoTabChange ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} role="tablist" aria-label="메모 범위">
              <button
                type="button"
                role="tab"
                aria-selected={p.memoTab === "USER"}
                onClick={() => p.onMemoTabChange?.("USER")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: `2px solid ${p.memoTab === "USER" ? t.primary : t.border}`,
                  background: p.memoTab === "USER" ? `${t.primary}14` : "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  color: p.memoTab === "USER" ? t.primary : t.textSecondary,
                  cursor: "pointer",
                }}
              >
                내 작업메모
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={p.memoTab === "PROJECT"}
                onClick={() => p.onMemoTabChange?.("PROJECT")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: `2px solid ${p.memoTab === "PROJECT" ? t.primary : t.border}`,
                  background: p.memoTab === "PROJECT" ? `${t.primary}14` : "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  color: p.memoTab === "PROJECT" ? t.primary : t.textSecondary,
                  cursor: "pointer",
                }}
              >
                프로젝트 작업메모
              </button>
            </div>
          ) : null}

          <input
            type="text"
            value={p.title}
            onChange={(e) => p.setTitle(e.target.value)}
            placeholder="제목을 입력하세요"
            disabled={!p.activeId || !p.editorHydrated}
            maxLength={200}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "8px 10px",
              borderRadius: 10,
              border: `1px solid ${t.borderStrong}`,
              fontSize: 14,
              fontWeight: 800,
              color: t.textPrimary,
              background: !p.activeId || !p.editorHydrated ? "#f8fafc" : "#fff",
            }}
          />

          {aiSummaryError ? (
            <div
              role="alert"
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#b91c1c",
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #fecaca",
                background: "#fff1f2",
              }}
            >
              {aiSummaryError}
            </div>
          ) : null}

          <div
            ref={editorRef}
            role="textbox"
            aria-multiline="true"
            contentEditable={Boolean(p.activeId) && p.editorHydrated}
            suppressContentEditableWarning
            data-placeholder="아이디어, TODO, 이미지 붙여넣기(Ctrl+V)…"
            onInput={syncFromEditor}
            onPaste={onPaste}
            onMouseUp={onEditorSelectEnd}
            onTouchEnd={onEditorSelectEnd}
            onScroll={() => setSelectionBubble(null)}
            style={{
              flex: "1 1 auto",
              minHeight: isNarrow ? 120 : 100,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              touchAction: "pan-y",
              boxSizing: "border-box",
              borderRadius: 12,
              border: `1px solid ${t.borderStrong}`,
              padding: "10px 12px",
              fontSize: 14,
              lineHeight: 1.5,
              color: t.textPrimary,
              background: Boolean(p.activeId) && p.editorHydrated ? "#fff" : "#f8fafc",
              fontFamily: "inherit",
              outline: "none",
              opacity: Boolean(p.activeId) && p.editorHydrated ? 1 : 0.85,
            }}
          />

          {aiInsight ? (
            <div
              role="region"
              aria-label="AI 요약 결과"
              style={{
                flex: "0 0 auto",
                maxHeight: isNarrow ? 200 : 220,
                overflow: "auto",
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${t.borderStrong}`,
                background: "#f8fafc",
                fontSize: 13,
                lineHeight: 1.55,
                color: t.textPrimary,
                whiteSpace: "pre-wrap",
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: t.textMuted, marginBottom: 6 }}>요약 결과</div>
              {aiInsight.summary}
              <div style={{ marginTop: 10, fontSize: 12, color: t.textSecondary }}>
                <div>
                  <span style={{ fontWeight: 800, color: t.textMuted }}>요청 분류</span> {aiInsight.requestType}
                </div>
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontWeight: 800, color: t.textMuted }}>우선순위 추천</span> {aiInsight.priority}
                  {aiInsight.priorityReason ? (
                    <span style={{ display: "block", marginTop: 4 }}>{aiInsight.priorityReason}</span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          flex: "0 0 auto",
          padding: "8px 12px 12px",
          borderTop: `1px solid ${t.border}`,
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px 10px",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: p.saveState === "error" ? "#b91c1c" : t.textMuted,
            whiteSpace: "nowrap",
            flex: "0 0 auto",
            minWidth: 0,
          }}
        >
          {workNoteSaveStateLabel(p.saveState, p.saveError)}
        </span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px 10px",
            flex: "1 1 auto",
            minWidth: 0,
            justifyContent: "flex-end",
          }}
        >
          {!isPage ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 800, color: t.textMuted, whiteSpace: "nowrap", flex: "0 0 auto" }}>
                창 투명도
              </span>
              <input
                type="range"
                min={35}
                max={100}
                value={Math.round(panelOpacity * 100)}
                aria-label="메모 창 투명도"
                onChange={(e) => {
                  const pct = workNotePanelClamp(Number(e.target.value), 35, 100);
                  const next = pct / 100;
                  setPanelOpacity(next);
                  writeWorkNotePanelStoredOpacity(next);
                }}
                style={{ flex: "1 1 100px", minWidth: 72, maxWidth: 200, accentColor: t.primary }}
              />
              <span style={{ fontSize: 11, fontWeight: 800, color: t.textSecondary, whiteSpace: "nowrap", flex: "0 0 auto" }}>
                {Math.round(panelOpacity * 100)}%
              </span>
            </>
          ) : null}
          {p.activeId && p.editorHydrated ? (
            <>
              <button
                type="button"
                onClick={() => void requestAiSummary()}
                disabled={aiSummarizing || p.listLoading}
                title="메모 내용을 AI로 요약합니다"
                aria-label={aiSummarizing ? "요약 중" : "AI 요약"}
                style={{
                  padding: "6px 12px",
                  borderRadius: 10,
                  border: `1px solid ${t.primary}`,
                  background: `${t.primary}12`,
                  color: t.primary,
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: aiSummarizing || p.listLoading ? "not-allowed" : "pointer",
                  opacity: aiSummarizing || p.listLoading ? 0.65 : 1,
                  flex: "0 0 auto",
                  whiteSpace: "nowrap",
                }}
              >
                {aiSummarizing ? "요약 중…" : "AI 요약"}
              </button>
              {aiInsight ? (
                <>
                  <button
                    type="button"
                    onClick={() => void applyAiSummaryToEditor()}
                    title="요약을 본문에 반영"
                    aria-label="요약본 반영"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 10,
                      border: `1px solid ${t.borderStrong}`,
                      background: t.primary,
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 900,
                      cursor: "pointer",
                      flex: "0 0 auto",
                      whiteSpace: "nowrap",
                    }}
                  >
                    요약본 반영
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiInsight(null);
                      setAiSummaryError(null);
                    }}
                    title="요약 패널 닫기"
                    aria-label="요약 닫기"
                    style={{
                      padding: "6px 12px",
                      borderRadius: 10,
                      border: `1px solid ${t.border}`,
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      color: t.textSecondary,
                      cursor: "pointer",
                      flex: "0 0 auto",
                      whiteSpace: "nowrap",
                    }}
                  >
                    요약 닫기
                  </button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {selectionBubble ? (
        <div
          ref={bubbleRef}
          role="tooltip"
          style={{
            position: "fixed",
            left: bubbleLeftClamped,
            top: selectionBubble.top,
            transform: "translateX(-50%)",
            zIndex: 100,
            maxWidth: "min(280px, calc(100% - 24px))",
            padding: "10px 12px",
            borderRadius: 12,
            border: `1px solid ${t.borderStrong}`,
            background: t.bgCard,
            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.18)",
            pointerEvents: "auto",
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: t.textPrimary, lineHeight: 1.45, marginBottom: 10 }}>
            선택한 내용을 대화 입력창에 넣을까요?
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => {
                const text = selectionBubble.text;
                setSelectionBubble(null);
                if (p.onShareToComposer) p.onShareToComposer(text);
                else window.alert("이 화면에서는 대화 입력창과 연결되어 있지 않습니다.");
              }}
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                border: `1px solid ${t.primary}`,
                background: t.primary,
                color: "#fff",
                fontSize: 12,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              넣기
            </button>
            <button
              type="button"
              onClick={() => setSelectionBubble(null)}
              style={{
                padding: "6px 12px",
                borderRadius: 10,
                border: `1px solid ${t.border}`,
                background: "#fff",
                fontSize: 12,
                fontWeight: 800,
                color: t.textSecondary,
                cursor: "pointer",
              }}
            >
              아니요
            </button>
          </div>
        </div>
      ) : null}

      {!isNarrow && !isPage ? (
        <button
          type="button"
          aria-label="크기 조절"
          onPointerDown={startResize}
          style={{
            position: "absolute",
            right: 4,
            bottom: 4,
            width: 18,
            height: 18,
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "nwse-resize",
            touchAction: "none",
            opacity: 0.45,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M22 22h-4v-2h2v-2h2v4zm-6 0h-4v-2h4v2zm-6 0h-4v-2h4v2zm-6 0H2v-4h2v2h2v2zm16-6h-2v-4h2v4zm0-6h-2V6h2v4zm0-6h-2V2h4v4z" />
          </svg>
        </button>
      ) : null}

      <style>{`
        [data-work-note-panel] [contenteditable="true"]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
        [data-work-note-panel] [contenteditable="true"] img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
    </>
  );
}
