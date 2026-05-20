"use client";

import { useEffect, type CSSProperties } from "react";
import {
  PROJECT_ARTIFACT_LABELS,
  PROJECT_ARTIFACT_MENU_ORDER,
  type ProjectArtifactType,
} from "@/lib/requirements/projectArtifactTypes";
import type { ProjectArtifactHubEntry } from "@/lib/requirements/projectArtifactHub";

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
  width: "min(420px, 100vw)",
  height: "100%",
  background: "#fff",
  borderLeft: "1px solid #e2e8f0",
  boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.12)",
  display: "flex",
  flexDirection: "column",
};

const itemBtnStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 4,
};

const genBtnStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "8px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  background: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  color: "#0f172a",
};

export function RequirementsArtifactHubDrawer({
  open,
  items,
  generateDisabled,
  onClose,
  onSelectEntry,
  onGenerate,
}: {
  readonly open: boolean;
  readonly items: readonly ProjectArtifactHubEntry[];
  readonly generateDisabled?: boolean;
  readonly onClose: () => void;
  readonly onSelectEntry: (entry: ProjectArtifactHubEntry) => void;
  readonly onGenerate: (type: ProjectArtifactType) => void;
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
      <aside style={panelStyle} aria-label="Artifact Hub">
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
            <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>Artifact Hub</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>산출물 생성·조회</div>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" style={closeBtnStyle}>
            ×
          </button>
        </header>
        <ArtifactHubBody
          items={items}
          generateDisabled={generateDisabled}
          onSelectEntry={onSelectEntry}
          onGenerate={onGenerate}
        />
      </aside>
    </>
  );
}

function ArtifactHubBody({
  items,
  generateDisabled,
  onSelectEntry,
  onGenerate,
}: {
  readonly items: readonly ProjectArtifactHubEntry[];
  readonly generateDisabled?: boolean;
  readonly onSelectEntry: (entry: ProjectArtifactHubEntry) => void;
  readonly onGenerate: (type: ProjectArtifactType) => void;
}) {
  return (
    <div style={{ flex: 1, overflow: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 16 }}>
      <section>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>새로 생성</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {PROJECT_ARTIFACT_MENU_ORDER.map((type) => (
            <button
              key={type}
              type="button"
              disabled={generateDisabled}
              style={{
                ...genBtnStyle,
                opacity: generateDisabled ? 0.5 : 1,
                cursor: generateDisabled ? "not-allowed" : "pointer",
              }}
              onClick={() => {
                if (generateDisabled) return;
                onGenerate(type);
              }}
            >
              {PROJECT_ARTIFACT_LABELS[type]}
            </button>
          ))}
        </div>
      </section>
      <section>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 8 }}>
          저장된 산출물 ({items.length})
        </div>
        {items.length === 0 ? (
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>생성된 산출물이 없습니다.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" style={itemBtnStyle} onClick={() => onSelectEntry(item)}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{item.title}</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    {item.sourceStage} · {item.kind === "deliverable" ? "기획 산출물" : "문서"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
