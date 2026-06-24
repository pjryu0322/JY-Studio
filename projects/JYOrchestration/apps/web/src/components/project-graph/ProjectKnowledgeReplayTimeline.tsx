"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { formatKnowledgeRevisionTimelineLabel } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";
import type { KnowledgeGraphRevisionListItem } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

export function ProjectKnowledgeReplayTimeline(p: {
  readonly revisions: readonly KnowledgeGraphRevisionListItem[];
  readonly selectedIndex: number;
  readonly onSelectIndex: (index: number) => void;
  readonly diffLines: readonly string[];
  readonly compact?: boolean;
}) {
  const listStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    overflow: "auto",
    flex: 1,
    minHeight: 0,
    padding: p.compact ? 8 : 12,
  };

  const itemBase: CSSProperties = {
    textAlign: "left",
    borderRadius: 10,
    border: `1px solid ${t.border}`,
    background: t.bgPage,
    padding: p.compact ? "10px 12px" : "10px 14px",
    cursor: "pointer",
    fontSize: 12,
  };

  return (
    <div
      data-testid="knowledge-replay-timeline"
      style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: p.compact ? undefined : "0 0 280px" }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, padding: p.compact ? "0 8px 8px" : "0 12px 8px", color: t.textPrimary }}>
        변화 타임라인
      </div>
      <div style={listStyle}>
        {p.revisions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: t.textMuted }} data-testid="knowledge-replay-empty">
            아직 저장된 그래프 변화가 없습니다. 대화 저장이나 추천안 승인 후 다시 확인해 주세요.
          </p>
        ) : (
          p.revisions.map((rev, index) => {
            const selected = index === p.selectedIndex;
            return (
              <button
                key={rev.id}
                type="button"
                data-testid={`knowledge-replay-timeline-item-${index}`}
                aria-pressed={selected}
                onClick={() => p.onSelectIndex(index)}
                style={{
                  ...itemBase,
                  borderColor: selected ? t.primary : t.border,
                  background: selected ? "#eff6ff" : t.bgPage,
                }}
              >
                <div style={{ fontWeight: 800, color: t.textPrimary }}>
                  {formatKnowledgeRevisionTimelineLabel(rev.createdAt)} {rev.title}
                </div>
                {rev.summary ? (
                  <div style={{ marginTop: 4, color: t.textSecondary, lineHeight: 1.4 }}>{rev.summary}</div>
                ) : null}
                <div style={{ marginTop: 6, fontSize: 11, color: t.textMuted }}>
                  노드 {rev.nodeCount} · 연결 {rev.edgeCount}
                </div>
              </button>
            );
          })
        )}
      </div>
      {p.revisions.length > 0 && p.diffLines.length > 0 ? (
        <div
          data-testid="knowledge-replay-diff"
          style={{
            flexShrink: 0,
            margin: p.compact ? "8px 8px 0" : "8px 12px 0",
            padding: "10px 12px",
            borderRadius: 10,
            border: `1px solid ${t.border}`,
            background: "#f8fafc",
            fontSize: 12,
            color: t.textSecondary,
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6, color: t.textPrimary }}>이전 시점 대비</div>
          {p.diffLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
