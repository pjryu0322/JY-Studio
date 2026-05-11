"use client";

import Link from "next/link";
import { ProjectRailCountBadge } from "@/components/layout/ProjectRailCountBadge";
import type { PlatformTopNavMeState } from "@/components/layout/platformTopNav/usePlatformTopNavAuth";
import { platformRailNavPrimaryText, platformRailNavTextCell } from "@/lib/layout/platformTopNavConstants";
import { projectMembersAdminHref } from "@/lib/project/projectMembersAdminHref";
import { ProjectWorkNoteButton } from "@/components/worknote/WorkNoteButton";
import { isPromptTimelineDebugClient } from "@/lib/debug/promptTimelineClientFlag";

type Props = Readonly<{
  effectiveProjectId: string;
  compactToolbar: boolean;
  me: PlatformTopNavMeState | null;
  projectMembersCount: number;
  projectWorkNotesCount: number;
}>;

export function ProjectRailSecondaryTools({
  effectiveProjectId,
  compactToolbar,
  me,
  projectMembersCount,
  projectWorkNotesCount,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compactToolbar ? 4 : 5, alignItems: "center", flexShrink: 0 }}>
      <div style={{ position: "relative", display: "inline-flex" }}>
        <ProjectWorkNoteButton notesProjectId={effectiveProjectId} railFooterLabel="문서" />
        <ProjectRailCountBadge count={projectWorkNotesCount} />
      </div>
      {Boolean(me) ? (
        <Link
          href={projectMembersAdminHref(effectiveProjectId)}
          prefetch={false}
          aria-label="멤버 · 프로젝트 멤버 관리로 이동"
          title="프로젝트 멤버"
          style={{
            ...platformRailNavTextCell,
            position: "relative",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span style={platformRailNavPrimaryText}>멤버</span>
          <ProjectRailCountBadge count={projectMembersCount} />
        </Link>
      ) : null}
      {Boolean(me) && isPromptTimelineDebugClient() ? (
        <Link
          href={`/prompt-timeline?projectId=${encodeURIComponent(effectiveProjectId)}`}
          prefetch={false}
          aria-label="프롬프트 타임라인"
          title="프롬프트 타임라인 (디버그)"
          style={{
            ...platformRailNavTextCell,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <span style={platformRailNavPrimaryText}>로그</span>
        </Link>
      ) : null}
    </div>
  );
}
