"use client";

import { useEffect, useState } from "react";
type Preview = {
  taskCount: number;
  aiActionCount: number;
  gitRequestCount: number;
  hasGitWork: boolean;
};

type Props = {
  open: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  onDeleted: () => void;
};

export function ProjectDeleteConfirmModal({
  open,
  projectId,
  projectName,
  onClose,
  onDeleted,
}: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setLoadError(null);
      setActionError(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/projects/${encodeURIComponent(projectId)}/delete-preview`,
          { credentials: "include" }
        );
        const json = (await res.json()) as { success?: boolean; data?: Preview; message?: string };
        if (cancelled) return;
        if (!res.ok || !json.success || !json.data) {
          setLoadError(json.message || "미리보기를 불러오지 못했습니다.");
          return;
        }
        setPreview(json.data);
      } catch {
        if (!cancelled) setLoadError("네트워크 오류");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function confirmDelete() {
    setActionError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        setActionError(json.message || "삭제에 실패했습니다.");
        return;
      }
      onDeleted();
      onClose();
    } catch {
      setActionError("네트워크 오류");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="project-delete-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(15,23,42,0.45)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
          border: "1px solid #e2e8f0",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="project-delete-title" style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 700 }}>
          프로젝트 삭제
        </h2>
        <p style={{ margin: "0 0 8px 0", fontSize: 14, color: "#334155", lineHeight: 1.5 }}>
          <strong>{projectName}</strong>을(를) 삭제할까요?
        </p>
        <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>
          이 작업은 되돌릴 수 없습니다. 프로젝트와 연결된 Task·AI 액션·Git 요청 등 데이터는 서버에 보관되며,
          목록에서는 기본적으로 숨겨집니다(소프트 삭제).
        </p>

        {loadError ? (
          <p style={{ color: "#b91c1c", fontSize: 13 }}>{loadError}</p>
        ) : preview ? (
          <ul style={{ margin: "0 0 16px 0", paddingLeft: 18, fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
            <li>Task 개수: {preview.taskCount}</li>
            <li>AI Action 개수: {preview.aiActionCount}</li>
            <li>Git 변경 요청: {preview.gitRequestCount}건 {preview.hasGitWork ? "(작업 이력 있음)" : ""}</li>
          </ul>
        ) : (
          <p style={{ fontSize: 13, color: "#64748b" }}>불러오는 중…</p>
        )}

        {actionError ? <p style={{ color: "#b91c1c", fontSize: 13 }}>{actionError}</p> : null}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: busy ? "not-allowed" : "pointer",
              fontSize: 14,
            }}
          >
            취소
          </button>
          <button
            type="button"
            data-testid="project-delete-confirm"
            onClick={() => void confirmDelete()}
            disabled={busy || !!loadError || !preview}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "#b91c1c",
              color: "#fff",
              cursor: busy || loadError || !preview ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {busy ? "처리 중…" : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
