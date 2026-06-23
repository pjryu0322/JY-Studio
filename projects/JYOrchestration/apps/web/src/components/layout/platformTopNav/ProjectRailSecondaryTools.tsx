"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ProjectKnowledgeGraphModal } from "@/components/project-graph/ProjectKnowledgeGraphModal";
import { ProjectRailCountBadge } from "@/components/layout/ProjectRailCountBadge";
import type { PlatformTopNavMeState } from "@/components/layout/platformTopNav/usePlatformTopNavAuth";
import {
  platformRailMessengerActiveShell,
  platformRailMessengerActiveText,
  platformRailNavPrimaryText,
  platformRailNavTextCell,
} from "@/lib/layout/platformTopNavConstants";
import { projectMembersAdminHref } from "@/lib/project/projectMembersAdminHref";
import { ProjectRailRecommendationButton } from "@/components/layout/platformTopNav/ProjectRailRecommendationButton";
import { ProjectWorkNoteButton } from "@/components/worknote/WorkNoteButton";
import { isPromptTimelineDebugClient } from "@/lib/debug/promptTimelineClientFlag";
type Props = Readonly<{
  effectiveProjectId: string;
  compactToolbar: boolean;
  meReady: boolean;
  me: PlatformTopNavMeState | null;
  projectMembersCount: number;
  projectWorkNotesCount: number;
}>;

export function ProjectRailSecondaryTools({
  effectiveProjectId,
  compactToolbar,
  meReady,
  me,
  projectMembersCount,
  projectWorkNotesCount,
}: Props) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const pathOnly = (pathname.split("?")[0] || "/").trim() || "/";
  const knowledgePacksActive = pathOnly === "/knowledge-packs" || pathOnly.startsWith("/knowledge-packs/");
  const knowledgeGraphActive =
    pathOnly === `/projects/${effectiveProjectId}/knowledge-graph` ||
    pathOnly.startsWith(`/projects/${encodeURIComponent(effectiveProjectId)}/knowledge-graph`);
  const sourceMessageId = String(searchParams?.get("sourceMessageId") ?? "").trim() || null;
  const [knowledgeGraphModalOpen, setKnowledgeGraphModalOpen] = useState(false);
  /** `/api/auth/me` 지연 시에도 지식팩 진입은 보이게(미로그인 확정 시에만 숨김). */
  const showKnowledgePacksLink = !meReady || Boolean(me);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compactToolbar ? 4 : 5, alignItems: "center", flexShrink: 0 }}>
      <div style={{ position: "relative", display: "inline-flex" }}>
        <ProjectWorkNoteButton notesProjectId={effectiveProjectId} railFooterLabel="메모" />
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
      {Boolean(me) ? (
        <>
          <button
            type="button"
            data-testid="platform-knowledge-graph-rail-project"
            aria-label="지식 그래프 생성 현황"
            title="Project Knowledge Graph 생성 현황"
            onClick={() => setKnowledgeGraphModalOpen(true)}
            style={{
              ...platformRailNavTextCell,
              ...(knowledgeGraphActive || knowledgeGraphModalOpen ? platformRailMessengerActiveShell : {}),
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              font: "inherit",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="6" cy="6" r="2" />
              <circle cx="18" cy="6" r="2" />
              <circle cx="12" cy="18" r="2" />
              <path d="M8 7h8" />
              <path d="M7 8l4 8" />
              <path d="M17 8l-4 8" />
            </svg>
            <span
              style={
                knowledgeGraphActive || knowledgeGraphModalOpen
                  ? platformRailMessengerActiveText
                  : platformRailNavPrimaryText
              }
            >
              그래프
            </span>
          </button>
          <ProjectKnowledgeGraphModal
            open={knowledgeGraphModalOpen}
            projectId={effectiveProjectId}
            sourceMessageId={sourceMessageId}
            onClose={() => setKnowledgeGraphModalOpen(false)}
          />
        </>
      ) : null}
      {showKnowledgePacksLink ? (
        <Link
          href="/knowledge-packs"
          prefetch={false}
          data-testid="platform-knowledge-packs-rail-project"
          aria-label="지식팩 · AI 개발 기준"
          title="지식팩 — Grid 등 AI개발자 참조 기준"
          style={{
            ...platformRailNavTextCell,
            ...(knowledgePacksActive ? platformRailMessengerActiveShell : {}),
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span style={knowledgePacksActive ? platformRailMessengerActiveText : platformRailNavPrimaryText}>지식팩</span>
        </Link>
      ) : null}
      {Boolean(me) ? <ProjectRailRecommendationButton effectiveProjectId={effectiveProjectId} /> : null}
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
