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
      {items.map((item) => (
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
          <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>
            {item.branchName ? `branch ${item.branchName}` : null}
            {item.commitSha ? `${item.branchName ? " · " : ""}commit ${item.commitSha.slice(0, 8)}` : null}
            {item.changedFileCount != null ? ` · files ${item.changedFileCount}` : null}
            {item.prUrl ? (
              <>
                {" · "}
                <a href={item.prUrl} target="_blank" rel="noreferrer">
                  PR{item.prNumber != null ? ` #${item.prNumber}` : ""}
                </a>
              </>
            ) : null}
          </p>
          {item.blockReason ? (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#b45309", fontWeight: 600 }}>
              {item.blockReason}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
