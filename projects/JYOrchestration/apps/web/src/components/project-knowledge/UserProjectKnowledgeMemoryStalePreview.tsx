"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";
import { USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO } from "@/lib/project-knowledge/projectKnowledgeUserMemoryTimelineUi";
import type { UserProjectKnowledgeMemoryStalePreviewV1 } from "@/lib/project-knowledge/projectKnowledgeUserMemoryStaleTypes";
import type { UserProjectKnowledgeMemoryStaleReason } from "@/lib/project-knowledge/projectKnowledgeUserMemoryStaleTypes";

const rowBtn: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 8px",
  borderRadius: 6,
  border: `1px solid ${t.border}`,
  background: t.bgPage,
  cursor: "pointer",
};

const REASON_LABEL_KO: Record<UserProjectKnowledgeMemoryStaleReason, string> = {
  ignored: "무시됨",
  low_relevance: "낮은 관련도",
  not_recently_used: "최근 미사용",
  old_source_project: "오래된 출처",
  manual_review: "검토 필요",
};

function countByReason(
  preview: UserProjectKnowledgeMemoryStalePreviewV1,
  reason: UserProjectKnowledgeMemoryStaleReason,
): number {
  return preview.candidates.filter((c) => c.reasons.includes(reason)).length;
}

export function UserProjectKnowledgeMemoryStalePreview(p: {
  readonly stalePreview: UserProjectKnowledgeMemoryStalePreviewV1 | null;
  readonly saving?: boolean;
  readonly onPin: (actionId: string, pinned: boolean) => void | Promise<void>;
  readonly onIgnore: (actionId: string, ignored: boolean) => void | Promise<void>;
}) {
  const preview = p.stalePreview;
  if (!preview?.candidateCount) return null;

  const ignoredCount = countByReason(preview, "ignored");
  const lowRelCount = countByReason(preview, "low_relevance");

  return (
    <div data-testid="user-memory-stale-preview" style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 11, color: t.textPrimary, marginBottom: 6 }}>정리 후보</div>
      <div style={{ fontSize: 11, color: t.textSecondary, marginBottom: 8, lineHeight: 1.5 }}>
        {ignoredCount > 0 ? <>무시된 항목 {ignoredCount}개</> : null}
        {ignoredCount > 0 && lowRelCount > 0 ? " · " : null}
        {lowRelCount > 0 ? <>낮은 관련도 항목 {lowRelCount}개</> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {preview.candidates.map((candidate, index) => {
          const testKey = `stale-${candidate.agent}-${index}`;
          const reasonText = candidate.reasons.map((r) => REASON_LABEL_KO[r]).join(", ");
          return (
            <div
              key={candidate.actionId}
              data-testid={`user-memory-stale-item-${testKey}`}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${t.border}`,
                background: "#fffbeb",
                fontSize: 11,
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 800, color: t.textPrimary }}>
                [정리 후보] {candidate.title}
              </div>
              <div style={{ color: t.textSecondary, marginTop: 4 }}>{candidate.promptSummary}</div>
              <div style={{ color: t.textMuted, marginTop: 4 }}>
                {USER_PROJECT_KNOWLEDGE_MEMORY_AGENT_LABELS_KO[candidate.agent]} · 사유: {reasonText}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  disabled={p.saving}
                  data-testid={`user-memory-stale-unignore-${testKey}`}
                  onClick={() => void p.onIgnore(candidate.actionId, false)}
                  style={rowBtn}
                >
                  무시 해제
                </button>
                <button
                  type="button"
                  disabled={p.saving}
                  data-testid={`user-memory-stale-pin-${testKey}`}
                  onClick={() => void p.onPin(candidate.actionId, true)}
                  style={rowBtn}
                >
                  고정
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
