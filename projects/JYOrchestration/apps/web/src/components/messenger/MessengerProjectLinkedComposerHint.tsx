"use client";

import { useCallback } from "react";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { appFlowStepHref } from "@/lib/workflow/flow-state";
import { openProjectRoomWindow } from "@/lib/ui/workspaceMode";

function ProjectSingleChatGoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

/** 프로젝트 연결 메신저 방 — composer 상단 안내 + SingleChat 이동 */
export function MessengerProjectLinkedComposerHint(p: { readonly projectId: string }) {
  const { mode: workspaceMode } = useWorkspaceMode();
  const projectId = p.projectId.trim();
  const href = projectId ? appFlowStepHref("requirements", projectId) : null;

  const goToProjectSingleChat = useCallback(() => {
    if (!projectId || !href) return;
    openProjectRoomWindow(projectId, workspaceMode, href);
  }, [projectId, workspaceMode, href]);

  if (!projectId) return null;

  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px",
        marginBottom: 8,
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        boxSizing: "border-box",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: "#475569", lineHeight: 1.45 }}>프로젝트 대화방에서 계속하세요</span>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          goToProjectSingleChat();
        }}
        title="프로젝트 SingleChat으로 이동"
        aria-label="프로젝트 SingleChat으로 이동"
        style={{
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 10,
          border: "1px solid #bae6fd",
          background: "#f0f9ff",
          color: "#0369a1",
          cursor: "pointer",
          padding: 0,
          boxSizing: "border-box",
        }}
      >
        <ProjectSingleChatGoIcon />
      </button>
    </div>
  );
}
