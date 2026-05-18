import type { TeamRuntimeTimelineItemDto } from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";
import {
  formatTimelineMeta,
  formatTimelineTime,
  timelineStatusBadgeStyle,
  timelineStatusLabel,
  truncateTimelineText,
} from "@/components/project/aiTeamRuntimeTimelineListFormat";

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
        const blockReason = truncateTimelineText(item.blockReason);
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
