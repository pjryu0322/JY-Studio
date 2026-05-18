import type { CSSProperties } from "react";

import type { TeamRuntimeTimelineItemDto } from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";
import {
  AI_TEAM_RUNTIME_TIMELINE_STATUS_LABEL_KO,
  type AiTeamRuntimeTimelineStatus,
} from "@/lib/ai-team-runtime/timeline";

function timelineStatusBadgeStyle(status: string): CSSProperties {
  const base: CSSProperties = {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 4,
    marginRight: 6,
  };
  switch (status) {
    case "succeeded":
      return { ...base, background: "#dcfce7", color: "#166534" };
    case "running":
      return { ...base, background: "#dbeafe", color: "#1d4ed8" };
    case "failed":
      return { ...base, background: "#fee2e2", color: "#991b1b" };
    case "blocked":
      return { ...base, background: "#fef3c7", color: "#b45309" };
    case "skipped":
      return { ...base, background: "#f1f5f9", color: "#64748b" };
    default:
      return { ...base, background: "#f8fafc", color: "#64748b" };
  }
}

function timelineStatusLabel(status: string): string {
  if (status in AI_TEAM_RUNTIME_TIMELINE_STATUS_LABEL_KO) {
    return AI_TEAM_RUNTIME_TIMELINE_STATUS_LABEL_KO[status as AiTeamRuntimeTimelineStatus];
  }
  return status;
}

function truncateText(value: string | null | undefined, max = 500): string | null {
  if (value == null || value === "") return null;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function formatTimelineMeta(item: TeamRuntimeTimelineItemDto): string {
  const parts: string[] = [];
  if (item.branchName) parts.push(`branch ${item.branchName}`);
  if (item.commitSha) parts.push(`commit ${item.commitSha.slice(0, 8)}`);
  if (item.changedFileCount != null && item.changedFileCount > 0) {
    parts.push(`files ${item.changedFileCount}`);
  }
  return parts.join(" · ");
}

function formatTimelineTime(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export function AiTeamRuntimeTimelineList({
  items,
}: {
  items: readonly TeamRuntimeTimelineItemDto[];
}) {
  if (items.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>아직 표시할 실행 타임라인이 없습니다.</p>
    );
  }

  return (
    <ul data-testid="ai-team-runtime-timeline" style={{ margin: 0, padding: 0 }}>
      {items.map((item) => {
        const meta = formatTimelineMeta(item);
        const blockReason = truncateText(item.blockReason);
        const startedLabel = formatTimelineTime(item.startedAt);
        const completedLabel = formatTimelineTime(item.completedAt);

        return (
          <li
            key={item.id}
            data-testid={`ai-team-runtime-timeline-${item.id}`}
            style={{
              listStyle: "none",
              margin: 0,
              padding: "8px 0",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            
            <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
              <span style={timelineStatusBadgeStyle(item.status)}>{timelineStatusLabel(item.status)}</span>
              {item.titleKo}
            </div>
            {item.summaryKo ? (
              <p style={{ margin: "0 0 4px", fontSize: 12, color: "#475569" }}>{item.summaryKo}</p>
            ) : null}
            {meta || item.prUrl ? (
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
                {meta}
                {item.prUrl ? (
                  <>
                    {meta ? " · " : null}
                    <a href={item.prUrl} target="_blank" rel="noreferrer">
                      PR{item.prNumber != null ? ` #${item.prNumber}` : ""}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            {startedLabel || completedLabel ? (
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94a3b8" }}>
                {startedLabel ? `시작: ${startedLabel}` : null}
                {startedLabel && completedLabel ? " · " : null}
                {completedLabel ? `완료: ${completedLabel}` : null}
              </p>
            ) : null}
            {blockReason ? (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                {blockReason}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
