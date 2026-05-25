"use client";

import Link from "next/link";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { ProjectRailCountBadge } from "@/components/layout/ProjectRailCountBadge";
import { appFlowStepIdToRailParticipantKey } from "@/lib/layout/projectRailParticipants";
import type { ProjectRailParticipantStepKey } from "@/lib/layout/projectRailParticipants";
import {
  platformRailNavPrimaryText,
  platformRailNavPrimaryTextWorkflowActive,
  platformRailNavTextCell,
} from "@/lib/layout/platformTopNavConstants";
import { appFlowStepHref, isWorkflowStepNavActive } from "@/lib/workflow/flow-state";
import type { AppFlowStepId } from "@/lib/workflow/flow-state";
import { workflowStepMeta } from "@/lib/workflow/workflowStepMeta";

function railShortLabel(stepId: AppFlowStepId): string {
  switch (stepId) {
    case "requirements":
      return "기획";
    case "execution":
      return "구현";
    case "prototype_review":
      return "검토";
    default:
      return "단계";
  }
}

type Props = Readonly<{
  effectiveProjectId: string;
  pathname: string;
  searchParams: ReadonlyURLSearchParams;
  compactToolbar: boolean;
  participantCounts: Partial<Record<ProjectRailParticipantStepKey, number>>;
  projectMembersCount: number;
}>;

export function ProjectRailWorkflowStrip({
  effectiveProjectId,
  pathname,
  searchParams,
  compactToolbar,
  participantCounts,
  projectMembersCount,
}: Props) {
  return (
    <nav
      aria-label="프로젝트 단계"
      style={{ display: "flex", flexDirection: "column", gap: compactToolbar ? 4 : 5, alignItems: "center", width: "100%", flexShrink: 0 }}
    >
      {workflowStepMeta.map((item) => {
        const href = appFlowStepHref(item.stepId, effectiveProjectId);
        const active = isWorkflowStepNavActive(item.stepId, pathname, searchParams, effectiveProjectId);
        const participantKey = appFlowStepIdToRailParticipantKey(item.stepId);
        const badgeCount = participantKey ? (participantCounts[participantKey] ?? projectMembersCount) : 0;
        const showBadge = item.stepId !== "requirements" && participantKey !== null && badgeCount > 0;
        const short = railShortLabel(item.stepId);
        return (
          <Link
            key={item.stepId}
            href={href}
            prefetch={false}
            aria-label={`${item.label} (${short})`}
            title={item.label}
            style={{
              ...platformRailNavTextCell,
              border: active ? "2px solid #2563eb" : "1px solid #e2e8f0",
              background: active ? "rgba(37,99,235,0.08)" : "transparent",
              position: "relative",
              textDecoration: "none",
              color: "inherit",
            }}
            aria-current={active ? "page" : undefined}
          >
            <span style={active ? platformRailNavPrimaryTextWorkflowActive : platformRailNavPrimaryText}>{short}</span>
            {showBadge ? <ProjectRailCountBadge count={badgeCount} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
