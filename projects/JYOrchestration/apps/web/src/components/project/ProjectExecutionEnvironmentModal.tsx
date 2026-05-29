"use client";

import { useEffect } from "react";
import type { Project } from "@/components/project-spec/types";
import { ProjectExecutionEnvironmentPanel } from "@/components/project/ProjectExecutionEnvironmentPanel";

export type ProjectExecutionEnvironmentModalProps = Readonly<{
  projectId: string;
  project: Project | null;
  canEdit: boolean;
  canRevealCursorApiKey?: boolean;
  open: boolean;
  onClose: () => void;
  onSetupSaved?: () => void;
}>;

export function ProjectExecutionEnvironmentModal(p: ProjectExecutionEnvironmentModalProps) {
  useEffect(() => {
    if (!p.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") p.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [p.open, p.onClose]);

  if (!p.open || !p.projectId.trim()) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-execution-environment-modal-title"
      data-testid="project-execution-environment-modal"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
    >
      <div
        style={{
          width: "min(800px, 100%)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.28)",
          overflow: "hidden",
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header
          style={{
            flexShrink: 0,
            padding: "14px 18px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <h2
            id="project-execution-environment-modal-title"
            style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#0f172a" }}
          >
            자동 생성 환경설정
          </h2>
        </header>
        <div style={{ flex: "1 1 auto", minHeight: 0, padding: "16px 18px", display: "flex", flexDirection: "column" }}>
          <ProjectExecutionEnvironmentPanel
            projectId={p.projectId}
            project={p.project}
            canEdit={p.canEdit}
            canRevealCursorApiKey={p.canRevealCursorApiKey}
            settingsSurface="modal"
            settingsPurpose="prototype"
            onExecutionSetupChanged={p.onSetupSaved}
          />
        </div>
      </div>
    </div>
  );
}
