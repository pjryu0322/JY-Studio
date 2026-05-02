"use client";

import { useState } from "react";
import { useWorkNotesPanel } from "@/hooks/useWorkNotesPanel";
import { WorkNoteDrawer } from "@/components/worknote/WorkNoteDrawer";

export function WorkNoteButton(p: {
  readonly projectId: string;
  readonly onShareToComposer?: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const w = useWorkNotesPanel(p.projectId, open);
  if (!p.projectId.trim()) return null;

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
        open={open}
        onClose={() => setOpen(false)}
        listLoading={w.listLoading}
        listError={w.listError}
        notes={w.notes}
        activeId={w.activeId}
        selectNote={w.selectNote}
        createNote={w.createNote}
        deleteNote={w.deleteNote}
        title={w.title}
        setTitle={w.setTitle}
        text={w.text}
        onChangeText={w.setText}
        editorHydrated={w.editorHydrated}
        saveState={w.saveState}
        saveError={w.saveError}
        onShareToComposer={p.onShareToComposer}
      />
    </>
  );
}
