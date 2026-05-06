"use client";

import Link from "next/link";
import { ProjectRailCountBadge } from "@/components/layout/ProjectRailCountBadge";
import type { PlatformTopNavMeState } from "@/components/layout/platformTopNav/usePlatformTopNavAuth";
import { platformRailIconLinkStyle } from "@/lib/layout/platformTopNavConstants";
import { projectMembersAdminHref } from "@/lib/project/projectMembersAdminHref";
import { ProjectWorkNoteButton } from "@/components/worknote/WorkNoteButton";
import { isPromptTimelineDebugClient } from "@/lib/debug/promptTimelineClientFlag";

type Props = Readonly<{
  effectiveProjectId: string;
  compactToolbar: boolean;
  me: PlatformTopNavMeState | null;
  projectMembersCount: number;
}>;

export function ProjectRailSecondaryTools({ effectiveProjectId, compactToolbar, me, projectMembersCount }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compactToolbar ? 8 : 10, alignItems: "center", flexShrink: 0 }}>
      <ProjectWorkNoteButton notesProjectId={effectiveProjectId} />
      {Boolean(me) ? (
        <Link
          href={projectMembersAdminHref(effectiveProjectId)}
          prefetch={false}
          aria-label="프로젝트 멤버"
          title="프로젝트 멤버"
          style={{ ...platformRailIconLinkStyle, position: "relative" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <ProjectRailCountBadge count={projectMembersCount} />
        </Link>
      ) : null}
      {Boolean(me) && isPromptTimelineDebugClient() ? (
        <Link
          href={`/prompt-timeline?projectId=${encodeURIComponent(effectiveProjectId)}`}
          prefetch={false}
          aria-label="프롬프트 타임라인"
          title="프롬프트 타임라인 (디버그)"
          style={platformRailIconLinkStyle}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}
