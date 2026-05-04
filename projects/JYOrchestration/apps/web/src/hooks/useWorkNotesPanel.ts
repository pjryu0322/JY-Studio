"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { editorHtmlToNoteRaw, escapeHtmlText, sanitizeWorkNoteHtml } from "@/lib/worknote/workNoteEditorHtml";

export type WorkNoteSaveState = "idle" | "saving" | "saved" | "error";

export type WorkNoteListItem = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

function normalizePersistContent(html: string): string {
  return sanitizeWorkNoteHtml(editorHtmlToNoteRaw(html));
}

function parseNoteDto(n: unknown): WorkNoteListItem | null {
  if (!n || typeof n !== "object") return null;
  const o = n as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return null;
  return {
    id,
    title: typeof o.title === "string" ? o.title : "",
    content: typeof o.content === "string" ? o.content : "",
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
  };
}

export function useWorkNotesPanel(projectId: string, open: boolean) {
  const [notes, setNotes] = useState<WorkNoteListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [editorHydrated, setEditorHydrated] = useState(false);
  const [saveState, setSaveState] = useState<WorkNoteSaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const skipNextAutosave = useRef(false);
  const activeIdRef = useRef<string | null>(null);
  const titleRef = useRef("");
  const textRef = useRef("");
  const notesRef = useRef<WorkNoteListItem[]>([]);
  const prevOpenRef = useRef(open);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const persist = useCallback(async (id: string, titleRaw: string, htmlRaw: string) => {
    const pid = projectId.trim();
    if (!pid || !id) return;
    const body = normalizePersistContent(htmlRaw);
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/work-notes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleRaw, content: body }),
      });
      const raw = await res.text();
      let json: { success?: boolean; message?: string; data?: { note?: unknown } } = {};
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : {};
      } catch {
        throw new Error("저장 응답을 해석할 수 없습니다.");
      }
      if (!res.ok || !json.success) throw new Error(typeof json.message === "string" ? json.message : "저장에 실패했습니다.");
      const dto = parseNoteDto(json.data?.note);
      if (dto) {
        setNotes((prev) => prev.map((n) => (n.id === dto.id ? { ...n, ...dto } : n)));
      }
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    }
  }, [projectId]);

  const flushActive = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id) return;
    await persist(id, titleRef.current, textRef.current);
  }, [persist]);

  const loadNotes = useCallback(async (signal?: AbortSignal): Promise<WorkNoteListItem[]> => {
    const pid = projectId.trim();
    if (!pid) return [];
    const res = await fetch(`/api/work-notes?projectId=${encodeURIComponent(pid)}`, {
      credentials: "include",
      cache: "no-store",
      signal,
    });
    const rawText = await res.text();
    let json: { success?: boolean; message?: string; data?: { notes?: unknown } } = {};
    try {
      json = rawText ? (JSON.parse(rawText) as typeof json) : {};
    } catch {
      throw new Error("서버 응답을 해석할 수 없습니다.");
    }
    if (!res.ok || !json.success) {
      throw new Error(typeof json.message === "string" ? json.message : "불러오지 못했습니다.");
    }
    const rawList = json.data?.notes;
    return Array.isArray(rawList) ? (rawList.map(parseNoteDto).filter(Boolean) as WorkNoteListItem[]) : [];
  }, [projectId]);

  useEffect(() => {
    if (!open || !projectId.trim()) return;
    const ac = new AbortController();
    setListError(null);
    setListLoading(true);
    setEditorHydrated(false);
    setSaveState("idle");
    setSaveError(null);

    void (async () => {
      try {
        const items = await loadNotes(ac.signal);
        if (ac.signal.aborted) return;
        setNotes(items);
        if (items.length) {
          const first = items[0];
          setActiveId(first.id);
          skipNextAutosave.current = true;
          setTitle(first.title);
          setText(first.content);
        } else {
          setActiveId(null);
          skipNextAutosave.current = true;
          setTitle("");
          setText("");
        }
        setEditorHydrated(true);
      } catch (e) {
        if (ac.signal.aborted) return;
        setListError(e instanceof Error ? e.message : "불러오지 못했습니다.");
        setNotes([]);
        setActiveId(null);
        skipNextAutosave.current = true;
        setTitle("");
        setText("");
        setEditorHydrated(true);
      } finally {
        if (!ac.signal.aborted) setListLoading(false);
      }
    })();

    return () => ac.abort();
  }, [open, projectId, loadNotes]);

  useEffect(() => {
    if (prevOpenRef.current && !open) {
      void flushActive();
    }
    prevOpenRef.current = open;
  }, [open, flushActive]);

  const selectNote = useCallback(
    async (id: string) => {
      if (activeIdRef.current === id) return;
      await flushActive();
      const row = notesRef.current.find((x) => x.id === id);
      setActiveId(id);
      if (row) {
        skipNextAutosave.current = true;
        setTitle(row.title);
        setText(row.content);
      }
    },
    [flushActive]
  );

  const createNote = useCallback(async () => {
    const pid = projectId.trim();
    if (!pid) return;
    await flushActive();
    const nextTitle = `새 메모 ${notesRef.current.length + 1}`;
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/work-notes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: pid, title: nextTitle, content: "" }),
      });
      const raw = await res.text();
      let json: { success?: boolean; message?: string; data?: { note?: unknown } } = {};
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : {};
      } catch {
        throw new Error("생성 응답을 해석할 수 없습니다.");
      }
      if (!res.ok || !json.success) throw new Error(typeof json.message === "string" ? json.message : "메모를 만들지 못했습니다.");
      const dto = parseNoteDto(json.data?.note);
      if (!dto) throw new Error("메모를 만들지 못했습니다.");
      setNotes((prev) => [dto, ...prev]);
      setActiveId(dto.id);
      skipNextAutosave.current = true;
      setTitle(dto.title);
      setText(dto.content);
      setSaveState("saved");
    } catch (e) {
      setSaveState("error");
      setSaveError(e instanceof Error ? e.message : "메모를 만들지 못했습니다.");
    }
  }, [flushActive, projectId]);

  const appendSnippetFromChat = useCallback(
    async (plain: string) => {
      const t = plain.trim();
      if (!t) return;
      let id = activeIdRef.current;
      if (!id) {
        await createNote();
        id = activeIdRef.current;
      }
      if (!id) return;
      const escaped = escapeHtmlText(t);
      const block = `<p style="margin:12px 0 0;padding:10px 12px;border-left:3px solid #0d9488;background:#f0fdf4;font-size:14px;line-height:1.55;color:#0f172a"><strong style="color:#0f766e">대화에서 붙여넣음</strong><br/>${escaped.replace(/\n/g, "<br>")}</p>`;
      setText((prev) => {
        const p = String(prev ?? "").trim();
        if (!p || p === "<br>" || p === "<div><br></div>") return block;
        return `${p}<br/>${block}`;
      });
    },
    [createNote]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      const pid = projectId.trim();
      if (!pid) return;
      await flushActive();
      try {
        const res = await fetch(`/api/work-notes/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        const raw = await res.text();
        let json: { success?: boolean; message?: string } = {};
        try {
          json = raw ? (JSON.parse(raw) as typeof json) : {};
        } catch {
          throw new Error("삭제 응답을 해석할 수 없습니다.");
        }
        if (!res.ok || !json.success) throw new Error(typeof json.message === "string" ? json.message : "삭제에 실패했습니다.");
      } catch (e) {
        setSaveState("error");
        setSaveError(e instanceof Error ? e.message : "삭제에 실패했습니다.");
        return;
      }

      const wasActive = activeIdRef.current === id;
      try {
        const items = await loadNotes();
        setNotes(items);
        if (wasActive) {
          if (items.length) {
            const first = items[0];
            setActiveId(first.id);
            skipNextAutosave.current = true;
            setTitle(first.title);
            setText(first.content);
          } else {
            setActiveId(null);
            skipNextAutosave.current = true;
            setTitle("");
            setText("");
          }
        }
      } catch (e) {
        setListError(e instanceof Error ? e.message : "목록을 다시 불러오지 못했습니다.");
      }
    },
    [flushActive, loadNotes, projectId]
  );

  useEffect(() => {
    if (!open || !editorHydrated || !activeId) return;
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void persist(activeId, title, text);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [text, title, open, editorHydrated, activeId, persist]);

  return {
    listLoading,
    listError,
    notes,
    activeId,
    selectNote,
    createNote,
    deleteNote,
    title,
    setTitle,
    text,
    setText,
    editorHydrated,
    saveState,
    saveError,
    flushPending: flushActive,
    appendSnippetFromChat,
  };
}
