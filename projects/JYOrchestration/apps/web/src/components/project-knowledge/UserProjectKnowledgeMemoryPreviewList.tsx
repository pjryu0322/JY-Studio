"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { PROJECT_KNOWLEDGE_AGENTS, type ProjectKnowledgeAgent } from "@/lib/project-knowledge/projectKnowledgeAgentRelevance";
import { USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTimelineUi";
import type {
  UserProjectKnowledgeMemoryPreviewItemV1,
  UserProjectKnowledgeMemoryPreviewV1,
} from "@/lib/project-knowledge/projectKnowledgeUserMemoryPreviewService";

const rowBtn: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 8px",
  borderRadius: 6,
  border: `1px solid ${t.border}`,
  background: t.bgPage,
  cursor: "pointer",
};

function PreviewItemRow(p: {
  readonly agent: ProjectKnowledgeAgent;
  readonly index: number;
  readonly item: UserProjectKnowledgeMemoryPreviewItemV1;
  readonly saving?: boolean;
  readonly variant: "active" | "ignored";
  readonly onPin: (actionId: string, pinned: boolean) => void | Promise<void>;
  readonly onIgnore: (actionId: string, ignored: boolean) => void | Promise<void>;
  readonly onExcludeSourceProject: (sourceProjectActionId: string) => void | Promise<void>;
}) {
  const testKey = p.variant === "ignored" ? `ignored-${p.agent}-${p.index}` : `${p.agent}-${p.index}`;
  return (
    <div
      data-testid={`user-memory-preview-item-${testKey}`}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: `1px solid ${t.border}`,
        background: p.variant === "ignored" ? "#f1f5f9" : "#fff",
        fontSize: 11,
        lineHeight: 1.45,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <div style={{ fontWeight: 800, color: t.textPrimary }}>{p.item.title}</div>
        {p.variant === "ignored" ? (
          <span
            data-testid={`user-memory-ignored-badge-${testKey}`}
            style={{ fontSize: 10, fontWeight: 800, color: "#64748b" }}
          >
            무시됨
          </span>
        ) : null}
      </div>
      <div style={{ color: t.textSecondary, marginTop: 4 }}>{p.item.promptSummary}</div>
      <div style={{ color: t.textMuted, marginTop: 4 }}>
        useAs: {p.item.useAs} · relevance: {p.item.relevance.toFixed(2)} · source:{" "}
        {p.item.sourceProjectTitle ?? "이전 프로젝트"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {p.variant === "active" ? (
          <>
            <button
              type="button"
              disabled={p.saving}
              data-testid={`user-memory-pin-${testKey}`}
              onClick={() => void p.onPin(p.item.actionId, !p.item.pinned)}
              style={rowBtn}
            >
              {p.item.pinned ? "고정 해제" : "고정"}
            </button>
            <button
              type="button"
              disabled={p.saving}
              data-testid={`user-memory-ignore-${testKey}`}
              onClick={() => void p.onIgnore(p.item.actionId, true)}
              style={rowBtn}
            >
              무시
            </button>
            {p.item.sourceProjectActionId ? (
              <button
                type="button"
                disabled={p.saving}
                data-testid={`user-memory-exclude-project-${testKey}`}
                onClick={() => void p.onExcludeSourceProject(p.item.sourceProjectActionId!)}
                style={rowBtn}
              >
                이 프로젝트 제외
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            disabled={p.saving}
            data-testid={`user-memory-unignore-${testKey}`}
            onClick={() => void p.onIgnore(p.item.actionId, false)}
            style={rowBtn}
          >
            무시 해제
          </button>
        )}
      </div>
    </div>
  );
}

export function UserProjectKnowledgeMemoryPreviewList(p: {
  readonly preview: UserProjectKnowledgeMemoryPreviewV1 | null;
  readonly saving?: boolean;
  readonly onPin: (actionId: string, pinned: boolean) => void | Promise<void>;
  readonly onIgnore: (actionId: string, ignored: boolean) => void | Promise<void>;
  readonly onExcludeSourceProject: (sourceProjectActionId: string) => void | Promise<void>;
}) {
  if (!p.preview) return null;

  const hasActive = PROJECT_KNOWLEDGE_AGENTS.some((agent) => (p.preview?.byAgent[agent]?.items.length ?? 0) > 0);
  const hasIgnored = PROJECT_KNOWLEDGE_AGENTS.some(
    (agent) => (p.preview?.byAgent[agent]?.ignoredItems?.length ?? 0) > 0,
  );

  if (!hasActive && !hasIgnored) {
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
        if (!block.items.length && !(block.ignoredItems?.length ?? 0)) return null;
        const label = USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO[agent];
        return (
          <div key={agent}>
            {block.items.length ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 12, color: t.textPrimary, marginBottom: 6 }}>
                  {label} · {block.itemCount}개
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {block.items.map((item, index) => (
                    <PreviewItemRow
                      key={`${agent}:active:${index}`}
                      agent={agent}
                      index={index}
                      item={item}
                      saving={p.saving}
                      variant="active"
                      onPin={p.onPin}
                      onIgnore={p.onIgnore}
                      onExcludeSourceProject={p.onExcludeSourceProject}
                    />
                  ))}
                </div>
              </>
            ) : null}
            {block.ignoredItems?.length ? (
              <details data-testid={`user-memory-ignored-section-${agent}`} open={block.ignoredItems.length <= 3}>
                <summary style={{ cursor: "pointer", fontWeight: 800, fontSize: 11, color: t.textSecondary, marginTop: 8 }}>
                  무시한 항목 ({block.ignoredItems.length})
                </summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                  {block.ignoredItems.map((item, index) => (
                    <PreviewItemRow
                      key={`${agent}:ignored:${index}`}
                      agent={agent}
                      index={index}
                      item={item}
                      saving={p.saving}
                      variant="ignored"
                      onPin={p.onPin}
                      onIgnore={p.onIgnore}
                      onExcludeSourceProject={p.onExcludeSourceProject}
                    />
                  ))}
                </div>
              </details>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
