"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { PROJECT_KNOWLEDGE_AGENTS } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTimelineUi";
import type { UserProjectKnowledgeMemoryPreviewV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService";

const rowBtn: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 8px",
  borderRadius: 6,
  border: `1px solid ${t.border}`,
  background: t.bgPage,
  cursor: "pointer",
};

export function UserProjectKnowledgeMemoryPreviewList(p: {
  readonly preview: UserProjectKnowledgeMemoryPreviewV1 | null;
  readonly saving?: boolean;
  readonly onPin: (displayId: string, pinned: boolean) => void | Promise<void>;
  readonly onIgnore: (displayId: string, ignored: boolean) => void | Promise<void>;
  readonly onExcludeSourceProject: (sourceProjectActionId: string) => void | Promise<void>;
}) {
  if (!p.preview) return null;

  const agentsWithItems = PROJECT_KNOWLEDGE_AGENTS.filter(
    (agent) => (p.preview?.byAgent[agent]?.items.length ?? 0) > 0,
  );

  if (!agentsWithItems.length) {
    return (
      <div data-testid="user-memory-preview-empty" style={{ color: t.textMuted, fontSize: 12, marginTop: 8 }}>
        참조할 과거 프로젝트 지식 항목이 없습니다.
      </div>
    );
  }

  return (
    <div data-testid="user-memory-preview-list" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
      {PROJECT_KNOWLEDGE_AGENTS.map((agent) => {
        const block = p.preview!.byAgent[agent];
        if (!block.items.length) return null;
        const label = USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO[agent];
        return (
          <div key={agent}>
            <div style={{ fontWeight: 800, fontSize: 12, color: t.textPrimary, marginBottom: 6 }}>
              {label} · {block.itemCount}개
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {block.items.map((item) => (
                <div
                  key={`${agent}:${item.displayId}`}
                  data-testid={`user-memory-preview-item-${item.displayId}`}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: `1px solid ${t.border}`,
                    background: "#fff",
                    fontSize: 11,
                    lineHeight: 1.45,
                  }}
                >
                  <div style={{ fontWeight: 800, color: t.textPrimary }}>{item.title}</div>
                  <div style={{ color: t.textSecondary, marginTop: 4 }}>{item.promptSummary}</div>
                  <div style={{ color: t.textMuted, marginTop: 4 }}>
                    useAs: {item.useAs} · relevance: {item.relevance.toFixed(2)} · source:{" "}
                    {item.sourceProjectTitle ?? "이전 프로젝트"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    <button
                      type="button"
                      disabled={p.saving}
                      data-testid={`user-memory-pin-${item.displayId}`}
                      onClick={() => void p.onPin(item.displayId, !item.pinned)}
                      style={rowBtn}
                    >
                      {item.pinned ? "고정 해제" : "고정"}
                    </button>
                    <button
                      type="button"
                      disabled={p.saving}
                      data-testid={`user-memory-ignore-${item.displayId}`}
                      onClick={() => void p.onIgnore(item.displayId, !item.ignored)}
                      style={rowBtn}
                    >
                      {item.ignored ? "무시 해제" : "무시"}
                    </button>
                    {item.sourceProjectActionId ? (
                      <button
                        type="button"
                        disabled={p.saving}
                        data-testid={`user-memory-exclude-project-${item.displayId}`}
                        onClick={() => void p.onExcludeSourceProject(item.sourceProjectActionId!)}
                        style={rowBtn}
                      >
                        이 프로젝트 제외
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
