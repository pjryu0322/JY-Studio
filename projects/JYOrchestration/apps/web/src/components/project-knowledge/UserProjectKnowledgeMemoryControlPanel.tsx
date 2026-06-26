"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { PROJECT_KNOWLEDGE_AGENTS } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTimelineUi";
import { useUserProjectKnowledgeMemoryControl } from "@/components/project-knowledge/hooks/useUserProjectKnowledgeMemoryControl";
import { UserProjectKnowledgeMemoryPreviewList } from "@/components/project-knowledge/UserProjectKnowledgeMemoryPreviewList";

const cardStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: `1px solid ${t.border}`,
  background: "#f8fafc",
  fontSize: 12,
  lineHeight: 1.45,
  marginBottom: 8,
};

export function UserProjectKnowledgeMemoryControlPanel(p: { readonly projectId: string }) {
  const {
    control,
    preview,
    loading,
    saving,
    error,
    reload,
    setEnabled,
    setAgentEnabled,
    togglePin,
    toggleIgnore,
    excludeSourceProject,
  } = useUserProjectKnowledgeMemoryControl(p.projectId);

  if (loading && !control) {
    return (
      <div data-testid="user-memory-control-panel" style={cardStyle} aria-live="polite">
        <div style={{ fontWeight: 800, color: t.textPrimary }}>과거 프로젝트 지식</div>
        <div style={{ marginTop: 4, color: t.textMuted }}>불러오는 중…</div>
      </div>
    );
  }

  const enabled = control?.enabled !== false;

  return (
    <div data-testid="user-memory-control-panel" style={cardStyle}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800, color: t.textPrimary }}>과거 프로젝트 지식</div>
        <button
          type="button"
          data-testid="user-memory-control-refresh"
          onClick={() => void reload()}
          style={{ fontSize: 11, fontWeight: 700, cursor: "pointer" }}
        >
          새로고침
        </button>
      </div>
      <p style={{ margin: "6px 0 0", color: t.textSecondary, fontSize: 11 }}>
        같은 사용자 계정의 이전 프로젝트에서 추출된 지식을 현재 프로젝트의 AI 멤버가 참고합니다.
      </p>
      {error ? (
        <div role="alert" style={{ marginTop: 8, color: "#b91c1c", fontSize: 11 }}>
          {error}
        </div>
      ) : null}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 10,
          fontWeight: 700,
          cursor: saving ? "wait" : "pointer",
        }}
      >
        <input
          type="checkbox"
          data-testid="user-memory-control-enabled"
          checked={enabled}
          disabled={saving}
          onChange={(e) => void setEnabled(e.target.checked)}
        />
        과거 프로젝트 지식 자동 반영
      </label>
      {enabled ? (
        <div data-testid="user-memory-agent-toggles" style={{ marginTop: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 11, color: t.textPrimary, marginBottom: 6 }}>
            AI 멤버별 반영
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {PROJECT_KNOWLEDGE_AGENTS.map((agent) => {
              const agentOn = control?.agentEnabled?.[agent] !== false;
              return (
                <label
                  key={agent}
                  data-testid={`user-memory-agent-toggle-${agent}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: saving ? "wait" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agentOn}
                    disabled={saving || !enabled}
                    onChange={(e) => void setAgentEnabled(agent, e.target.checked)}
                  />
                  {USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO[agent]}
                </label>
              );
            })}
          </div>
        </div>
      ) : null}
      {!enabled ? (
        <div data-testid="user-memory-control-disabled-msg" style={{ marginTop: 8, color: t.textMuted }}>
          현재 프로젝트에서는 과거 프로젝트 지식을 자동 반영하지 않습니다.
        </div>
      ) : (
        <>
          {preview ? (
            <div
              data-testid="user-memory-agent-summary"
              style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 10, fontSize: 11 }}
            >
              {PROJECT_KNOWLEDGE_AGENTS.map((agent) => (
                <span key={agent} style={{ color: t.textSecondary }}>
                  {USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO[agent]}{" "}
                  {preview.byAgent[agent]?.itemCount ?? 0}개
                </span>
              ))}
              <span style={{ color: t.textMuted }}>
                · 출처 {preview.sourceProjectCount}개 프로젝트
              </span>
            </div>
          ) : null}
          <UserProjectKnowledgeMemoryPreviewList
            preview={preview}
            saving={saving}
            onPin={togglePin}
            onIgnore={toggleIgnore}
            onExcludeSourceProject={excludeSourceProject}
          />
        </>
      )}
    </div>
  );
}
