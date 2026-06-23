"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { fetchProjectById } from "@/components/project-spec/api";
import { WorkNoteDrawer } from "@/components/worknote/WorkNoteDrawer";
import { useWorkNoteComposerInsertHandler } from "@/components/worknote/WorkNoteComposerInsertContext";
import { WORK_NOTE_PENDING_CHAT_STORAGE_KEY } from "@/components/worknote/workNotePendingChatKey";
import { useWorkNotesPanel } from "@/hooks/useWorkNotesPanel";

function shellStyle(): CSSProperties {
  return {
    flex: "1 1 auto",
    minHeight: 0,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    boxSizing: "border-box",
  };
}

export function WorkNotesPageClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const projectId = sp.get("projectId")?.trim() ?? "";
  const inProject = Boolean(projectId);
  const [projectName, setProjectName] = useState<string | null>(null);
  const insertMemoIntoComposer = useWorkNoteComposerInsertHandler();

  useEffect(() => {
    if (!projectId) {
      setProjectName(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { project } = await fetchProjectById(projectId);
        if (!cancelled) setProjectName(String(project?.name ?? "").trim() || null);
      } catch {
        if (!cancelled) setProjectName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  const userPanel = useWorkNotesPanel({
    memoScope: "USER",
    projectId: null,
    enabled: !inProject,
  });
  const projectPanel = useWorkNotesPanel({
    memoScope: "PROJECT",
    projectId: projectId || null,
    enabled: inProject,
  });

  const active = inProject ? projectPanel : userPanel;

  const pendingChatSnippetRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(WORK_NOTE_PENDING_CHAT_STORAGE_KEY);
      if (raw == null || raw === "") return;
      sessionStorage.removeItem(WORK_NOTE_PENDING_CHAT_STORAGE_KEY);
      if (!inProject) return;
      pendingChatSnippetRef.current = raw;
    } catch {
      /* ignore */
    }
  }, [inProject, projectId]);

  const flushPendingChatSnippet = useCallback(() => {
    const chunk = pendingChatSnippetRef.current;
    if (!chunk || !active.editorHydrated) return;
    pendingChatSnippetRef.current = null;
    void active.appendSnippetFromChat(chunk);
  }, [active.editorHydrated, active.appendSnippetFromChat]);

  useEffect(() => {
    flushPendingChatSnippet();
  }, [flushPendingChatSnippet, active.activeId]);

  const activeMemoScope = inProject ? ("PROJECT" as const) : ("USER" as const);
  const activeProjectId = inProject ? (projectId || null) : null;
  const memoBadgeKind = activeMemoScope;
  const memoBadgeSubtitle = inProject ? (projectName?.trim() || "이 프로젝트") : ":메모";

  const handleClose = useCallback(() => {
    void (async () => {
      await active.flushPending();
      if (projectId) {
        router.push(`/requirements?projectId=${encodeURIComponent(projectId)}`);
      } else {
        router.push("/");
      }
    })();
  }, [active, projectId, router]);

  return (
    <main style={shellStyle()}>
      <WorkNoteDrawer
        variant="page"
        activeMemoScope={activeMemoScope}
        activeProjectId={activeProjectId}
        memoBadgeKind={memoBadgeKind}
        memoBadgeSubtitle={memoBadgeSubtitle}
        showMemoTabs={false}
        open
        onClose={handleClose}
        listLoading={active.listLoading}
        listError={active.listError}
        notes={active.notes}
        activeId={active.activeId}
        selectNote={active.selectNote}
        createNote={active.createNote}
        deleteNote={active.deleteNote}
        reorderNotes={active.reorderNotes}
        title={active.title}
        setTitle={active.setTitle}
        text={active.text}
        onChangeText={active.setText}
        editorHydrated={active.editorHydrated}
        saveState={active.saveState}
        saveError={active.saveError}
        onShareToComposer={insertMemoIntoComposer}
      />
    </main>
  );
}
