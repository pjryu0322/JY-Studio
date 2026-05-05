"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkNotesPanel } from "@/hooks/useWorkNotesPanel";
import { WorkNoteDrawer } from "@/components/worknote/WorkNoteDrawer";
import { useWorkNoteChatSelectionBridge } from "@/components/worknote/WorkNoteChatSelectionBridge";

export type WorkNoteButtonProps = Readonly<{
  /** URL 기준 프로젝트 컨텍스트 — 없으면 USER 메모만 */
  notesProjectId: string | null;
  readonly projectDisplayName?: string | null;
  readonly onShareToComposer?: (text: string) => void;
}>;

export function WorkNoteButton(p: WorkNoteButtonProps) {
  const [open, setOpen] = useState(false);
  const ctxPid = p.notesProjectId?.trim() ?? "";
  const inProject = Boolean(ctxPid);
  const [memoTab, setMemoTab] = useState<"USER" | "PROJECT">("PROJECT");

  const userPanel = useWorkNotesPanel({
    memoScope: "USER",
    projectId: null,
    enabled: open && (!inProject || memoTab === "USER"),
  });
  const projectPanel = useWorkNotesPanel({
    memoScope: "PROJECT",
    projectId: ctxPid || null,
    enabled: open && inProject && memoTab === "PROJECT",
  });

  const active = !inProject || memoTab === "USER" ? userPanel : projectPanel;

  const switchMemoTab = useCallback(
    async (next: "USER" | "PROJECT") => {
      if (!inProject || next === memoTab) return;
      if (memoTab === "USER") await userPanel.flushPending();
      else await projectPanel.flushPending();
      setMemoTab(next);
    },
    [inProject, memoTab, userPanel, projectPanel]
  );

  useEffect(() => {
    if (!open || !inProject) setMemoTab("PROJECT");
  }, [open, inProject, ctxPid]);

  const bridge = useWorkNoteChatSelectionBridge();
  const pendingChatSnippetRef = useRef<string | null>(null);

  const flushPendingChatSnippet = useCallback(() => {
    const chunk = pendingChatSnippetRef.current;
    if (!chunk || !open || !active.editorHydrated) return;
    pendingChatSnippetRef.current = null;
    void active.appendSnippetFromChat(chunk);
  }, [open, active.editorHydrated, active.appendSnippetFromChat]);

  useEffect(() => {
    flushPendingChatSnippet();
  }, [flushPendingChatSnippet, active.activeId]);

  useEffect(() => {
    if (!bridge || !ctxPid || bridge.projectId !== ctxPid) return;
    bridge.registerWorkNoteAppendFromChat((text) => {
      pendingChatSnippetRef.current = text;
      setMemoTab("PROJECT");
      setOpen(true);
    });
    return () => bridge.registerWorkNoteAppendFromChat(null);
  }, [bridge, ctxPid]);

  const activeMemoScope = !inProject ? "USER" : memoTab;
  const activeProjectId = inProject && memoTab === "PROJECT" ? ctxPid : null;

  const memoBadgeKind = activeMemoScope;
  const memoBadgeSubtitle = activeMemoScope === "USER" ? "내 작업메모" : (p.projectDisplayName?.trim() || "이 프로젝트");

  return (
    <>
      <button
        type="button"
        data-testid="work-note-open"
        aria-label="작업메모"
        title="작업메모"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          position: "relative",
          border: "1px solid #cbd5e1",
          background: "#fff",
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
        </svg>
      </button>
      <WorkNoteDrawer
        activeMemoScope={activeMemoScope}
        activeProjectId={activeProjectId}
        memoBadgeKind={memoBadgeKind}
        memoBadgeSubtitle={memoBadgeSubtitle}
        showMemoTabs={inProject}
        memoTab={inProject ? memoTab : undefined}
        onMemoTabChange={inProject ? switchMemoTab : undefined}
        open={open}
        onClose={() => setOpen(false)}
        listLoading={active.listLoading}
        listError={active.listError}
        notes={active.notes}
        activeId={active.activeId}
        selectNote={active.selectNote}
        createNote={active.createNote}
        deleteNote={active.deleteNote}
        title={active.title}
        setTitle={active.setTitle}
        text={active.text}
        onChangeText={active.setText}
        editorHydrated={active.editorHydrated}
        saveState={active.saveState}
        saveError={active.saveError}
        onShareToComposer={p.onShareToComposer}
      />
    </>
  );
}
