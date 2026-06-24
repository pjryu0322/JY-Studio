"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import {
  formatKnowledgeRevisionTimeOnly,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";
import type { KnowledgeGraphRevisionListItem } from "@/lib/project-knowledge/projectKnowledgeGraphRevisionTypes";

const clampStyle: CSSProperties = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

export function ProjectKnowledgeReplayTimeline(p: {
  readonly revisions: readonly KnowledgeGraphRevisionListItem[];
  readonly selectedIndex: number;
  readonly onSelectIndex: (index: number) => void;
  readonly diffLines: readonly string[];
  readonly changeHintsByIndex?: readonly (string | null)[];
  readonly compact?: boolean;
  readonly clampSummary?: boolean;
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
    minHeight: 44,
  };

  const diffBlockLines = p.diffLines.filter((line) => line !== "변화 없음");

  return (
    <div
      data-testid="knowledge-replay-timeline"
      style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: p.compact ? undefined : "0 0 280px" }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, padding: p.compact ? "0 8px 8px" : "0 12px 8px", color: t.textPrimary }}>
        변화 이력
      </div>
      <div style={listStyle}>
        {p.revisions.length === 0 ? (
          <div style={{ margin: 0, fontSize: 12, color: t.textMuted, lineHeight: 1.5 }} data-testid="knowledge-replay-empty">
            <p style={{ margin: "0 0 8px" }}>아직 표시할 변화 이력이 없습니다.</p>
            <p style={{ margin: 0 }}>기획 대화를 진행하거나 추천안을 적용하면 변화 이력이 생성됩니다.</p>
          </div>
        ) : (
          p.revisions.map((rev, index) => {
            const selected = index === p.selectedIndex;
            const hint = p.changeHintsByIndex?.[index] ?? null;
            return (
              <button
                key={rev.id}
                type="button"
                data-testid={`knowledge-replay-timeline-item-${index}`}
                aria-pressed={selected}
                aria-current={selected ? "step" : undefined}
                onClick={() => p.onSelectIndex(index)}
                style={{
                  ...itemBase,
                  borderColor: selected ? t.primary : t.border,
                  borderWidth: selected ? 2 : 1,
                  background: selected ? "#eff6ff" : t.bgPage,
                  boxShadow: selected ? "0 0 0 1px rgba(37,99,235,0.15)" : undefined,
                }}
              >
                <div style={{ fontSize: 11, color: t.textMuted, fontWeight: 700 }}>{formatKnowledgeRevisionTimeOnly(rev.createdAt)}</div>
                <div style={{ fontWeight: 800, color: t.textPrimary, marginTop: 2 }}>{rev.title}</div>
                {hint ? (
                  <div style={{ marginTop: 6, fontSize: 11, color: t.textSecondary, lineHeight: 1.4 }}>{hint}</div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 11, color: t.textMuted }}>
                    항목 {rev.nodeCount}개 · 연결 {rev.edgeCount}개
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
      {p.revisions.length > 0 && diffBlockLines.length > 0 ? (
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
            ...(p.clampSummary ? { ...clampStyle, WebkitLineClamp: 3 } : {}),
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 6, color: t.textPrimary }}>이번 변경</div>
          {diffBlockLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
