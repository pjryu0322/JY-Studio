import type { CSSProperties } from "react";

import type { TeamRuntimeTimelineItemDto } from "@/components/project-spec/apis/executionLoopEnvironmentRunsApi";
import {
  AI_TEAM_RUNTIME_TIMELINE_STATUS_LABEL_KO,
  type AiTeamRuntimeTimelineStatus,
} from "@/lib/ai-team-runtime/timeline";

export function timelineStatusBadgeStyle(status: string): CSSProperties {
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

export function timelineStatusLabel(status: string): string {
  if (status in AI_TEAM_RUNTIME_TIMELINE_STATUS_LABEL_KO) {
    return AI_TEAM_RUNTIME_TIMELINE_STATUS_LABEL_KO[status as AiTeamRuntimeTimelineStatus];
  }
  return status;
}

export function truncateTimelineText(value: string | null | undefined, max = 500): string | null {
  if (value == null || value === "") return null;
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

export function formatTimelineMeta(item: TeamRuntimeTimelineItemDto): string {
  const parts: string[] = [];
  if (item.branchName) parts.push(`branch ${item.branchName}`);
  if (item.commitSha) parts.push(`commit ${item.commitSha.slice(0, 8)}`);
  if (item.changedFileCount != null && item.changedFileCount > 0) {
    parts.push(`files ${item.changedFileCount}`);
  }
  return parts.join(" · ");
}

export function formatTimelineTime(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}
