"use client";

import { useEffect, type CSSProperties } from "react";
import type { ProjectCanvasArtifact } from "@/lib/requirements/projectCanvasHub";

const backdropStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1150,
  background: "rgba(15, 23, 42, 0.4)",
};

const panelStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  zIndex: 1160,
  width: "min(400px, 100vw)",
  height: "100%",
  background: "#fff",
  borderLeft: "1px solid #e2e8f0",
  boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.12)",
  display: "flex",
  flexDirection: "column",
};

const statusLabel: Record<ProjectCanvasArtifact["status"], string> = {
  draft: "초안",
  candidate: "후보",
  confirmed: "확정",
  obsolete: "이전",
};

export function RequirementsCanvasHubDrawer({
  open,
  items,
  onClose,
  onSelect,
}: {
  readonly open: boolean;
  readonly items: readonly ProjectCanvasArtifact[];
  readonly onClose: () => void;
  readonly onSelect: (item: ProjectCanvasArtifact) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div style={backdropStyle} role="presentation" onClick={onClose} />
      <aside style={panelStyle} aria-label="Canvas Hub">
        <header
          style={{
            padding: "16px 18px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Canvas Hub</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>프로젝트 상태·산출물 Viewer</div>
          </div>
          <button type="button" onClick={onClose} style={closeBtnStyle} aria-label="닫기">
            ×
          </button>
        </header>
        <div style={{ flex: 1, overflow: "auto", padding: "12px 14px" }}>
          {items.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              표시할 Canvas 항목이 없습니다. 서비스 흐름·대안·산출물이 생성되면 여기에 나타납니다.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onSelect(item)} style={itemBtnStyle}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{item.title}</span>
                    <span style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
                      {statusLabel[item.status]} · {item.sourceStage}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

const closeBtnStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 8,
  width: 32,
  height: 32,
  fontSize: 18,
  cursor: "pointer",
  lineHeight: 1,
};

const itemBtnStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "12px 14px",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
};
