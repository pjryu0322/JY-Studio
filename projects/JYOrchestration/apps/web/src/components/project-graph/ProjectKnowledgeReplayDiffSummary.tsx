"use client";

import { uiTokens as t } from "@/components/ui/tokens";
import { ProjectKnowledgeReplayDiffSummary } from "@/components/project-graph/ProjectKnowledgeReplayDiffSummary";
import {
  formatKnowledgeRevisionDiffOverflowMessage,
  summarizeKnowledgeRevisionDiffLines,
} from "@/lib/project-knowledge/projectKnowledgeGraphRevisionUi";

export function ProjectKnowledgeReplayDiffSummary(p: {
  readonly lines: readonly string[];
  readonly testId?: string;
}) {
  const { visibleLines, overflowCount } = summarizeKnowledgeRevisionDiffLines(p.lines);
  const overflowMessage = formatKnowledgeRevisionDiffOverflowMessage(overflowCount);
  if (visibleLines.length === 0) return null;

  return (
    <div data-testid={p.testId ?? "knowledge-replay-diff-summary"}>
      <div style={{ fontWeight: 800, color: t.textPrimary, marginBottom: 4 }}>이번 변경</div>
      {visibleLines.map((line) => (
        <div key={line}>{line}</div>
      ))}
      {overflowMessage ? (
        <div data-testid="knowledge-replay-diff-overflow" style={{ marginTop: 4, color: t.textMuted }}>
          {overflowMessage}
        </div>
      ) : null}
    </div>
  );
}
