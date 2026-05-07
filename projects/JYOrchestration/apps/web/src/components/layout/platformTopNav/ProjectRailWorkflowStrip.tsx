"use client";

import Link from "next/link";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { ProjectRailCountBadge } from "@/components/layout/ProjectRailCountBadge";
import { workflowStepRailGlyph } from "@/components/layout/platformTopNav/workflowStepRailGlyph";
import { appFlowStepIdToRailParticipantKey } from "@/lib/layout/projectRailParticipants";
import type { ProjectRailParticipantStepKey } from "@/lib/layout/projectRailParticipants";
import { platformRailIconLinkStyle } from "@/lib/layout/platformTopNavConstants";
import { appFlowStepHref, isWorkflowStepNavActive } from "@/lib/workflow/flow-state";
import { workflowStepMeta } from "@/lib/workflow/workflowStepMeta";

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
      style={{ display: "flex", flexDirection: "column", gap: compactToolbar ? 8 : 10, alignItems: "center", width: "100%", flexShrink: 0 }}
    >
      {workflowStepMeta.map((item) => {
        const href = appFlowStepHref(item.stepId, effectiveProjectId);
        const active = isWorkflowStepNavActive(item.stepId, pathname, searchParams, effectiveProjectId);
        const participantKey = appFlowStepIdToRailParticipantKey(item.stepId);
        const badgeCount = participantKey ? (participantCounts[participantKey] ?? projectMembersCount) : 0;
        const showBadge = participantKey !== null && badgeCount > 0;
        return (
          <Link
            key={item.stepId}
            href={href}
            prefetch={false}
            aria-label={item.label}
            title={item.label}
            style={{
              ...platformRailIconLinkStyle,
              border: active ? "2px solid #2563eb" : platformRailIconLinkStyle.border,
              background: active ? "rgba(37,99,235,0.08)" : platformRailIconLinkStyle.background,
              color: active ? "#2563eb" : platformRailIconLinkStyle.color,
              fontSize: 12,
              fontWeight: 900,
              position: "relative",
            }}
            aria-current={active ? "page" : undefined}
          >
            <span aria-hidden style={{ lineHeight: 1, display: "inline-flex" }}>
              {workflowStepRailGlyph(item.stepId)}
            </span>
            {showBadge ? <ProjectRailCountBadge count={badgeCount} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
