"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProjectRailCountBadge } from "@/components/layout/ProjectRailCountBadge";
import { TopRightToolbar } from "@/components/layout/TopRightToolbar";
import { useProjectRailBadges } from "@/components/layout/useProjectRailBadges";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { appFlowStepHref, isWorkflowStepNavActive, readLastFlowProjectId, resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";
import { workflowStepMeta } from "@/lib/workflow/workflowStepMeta";
import { appFlowStepIdToRailParticipantKey } from "@/lib/layout/projectRailParticipants";
import { fetchProjectById } from "@/components/project-spec/api";
import { projectMembersAdminHref } from "@/lib/project/projectMembersAdminHref";
import { ProjectWorkNoteButton } from "@/components/worknote/WorkNoteButton";
import { isPromptTimelineDebugClient } from "@/lib/debug/promptTimelineClientFlag";

const PLATFORM_RAIL_COLLAPSED_KEY = "jyo:platformRailCollapsed";

/** 아이콘·패딩 기준 최소 폭 (브랜딩 영역 없음) */
const RAIL_WIDTH_PX = 52;
/** 접힘 시 화면 좌측에 남기는 펼치기 탭 폭 */
const RAIL_EXPAND_TAB_W = 30;

type MeState = {
  id: string;
  displayName: string;
  email: string;
  isPlatformAdmin: boolean;
  avatarUrl: string | null;
};

const railIconLinkStyle: CSSProperties = {
  width: 36,
  height: 36,
  padding: 0,
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  boxSizing: "border-box",
  cursor: "pointer",
  outlineOffset: 2,
  textDecoration: "none",
};

function workflowGlyph(label: string): string {
  const t = label.trim();
  if (!t) return "•";
  // Korean labels: show first meaningful syllable.
  return t.slice(0, 1);
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function PlatformTopNav() {
  const { effectiveLayout } = useWorkspaceMode();
  const [layoutHydrated, setLayoutHydrated] = useState(false);
  useEffect(() => {
    setLayoutHydrated(true);
  }, []);
  const compactToolbar = layoutHydrated && effectiveLayout === "MOBILE";
  const showScreenLabels = useShowScreenLabels();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const pathOnly = (pathname.split("?")[0] || "/").trim() || "/";
  const [me, setMe] = useState<MeState | null>(null);
  const [meReady, setMeReady] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(PLATFORM_RAIL_COLLAPSED_KEY) === "1") {
        setRailCollapsed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistRailCollapsed = useCallback((next: boolean) => {
    setRailCollapsed(next);
    try {
      localStorage.setItem(PLATFORM_RAIL_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const projectId = useMemo(
    () => resolveWorkflowProjectContextId(pathname, searchParams),
    [pathname, searchParams]
  );
  // Keep project rail stable even if a route forgets `?projectId=` (use last selected project id).
  const effectiveProjectId = useMemo(() => {
    const pid = String(projectId ?? "").trim();
    if (pid) return pid;
    // Never force project rail on home/project list surfaces.
    if (pathOnly === "/" || pathOnly === "/workspace") return null;
    const fallback = readLastFlowProjectId()?.trim() ?? "";
    return fallback || null;
  }, [projectId, pathOnly]);
  const hasProjectContext = Boolean(effectiveProjectId?.trim());
  const { participantCounts, memberCount: projectMembersCount } = useProjectRailBadges(effectiveProjectId);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json()) as {
          success?: boolean;
          data?: {
            id?: string | null;
            name?: string | null;
            displayName?: string | null;
            nickname?: string | null;
            email?: string | null;
            avatarUrl?: string | null;
            isPlatformAdmin?: boolean;
          } | null;
        };
        if (cancelled) return;
        if (res.ok && json.success && json.data && String(json.data.id ?? "").trim()) {
          const email = String(json.data.email ?? "").trim();
          const d = String(json.data.displayName ?? "").trim();
          const nick = String(json.data.nickname ?? "").trim();
          const legal = String(json.data.name ?? "").trim();
          const displayName = d || nick || legal || "사용자";
          const av = String(json.data.avatarUrl ?? "").trim();
          setMe({
            id: String(json.data.id ?? "").trim(),
            displayName,
            email,
            isPlatformAdmin: Boolean(json.data.isPlatformAdmin),
            avatarUrl: av || null,
          });
        } else {
          setMe(null);
        }
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setMeReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [me?.avatarUrl, me?.id]);

  useEffect(() => {
    let cancelled = false;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      setProjectName(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const { project } = await fetchProjectById(pid);
        if (cancelled) return;
        const name = String(project?.name ?? "").trim();
        setProjectName(name || null);
      } catch {
        if (!cancelled) setProjectName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  }

  const expandTabStyle = {
    position: "fixed" as const,
    left: 0,
    top: "50%",
    transform: "translateY(-50%)",
    zIndex: 45,
    width: RAIL_EXPAND_TAB_W,
    height: 52,
    padding: 0,
    borderRadius: "0 10px 10px 0",
    border: "1px solid #e2e8f0",
    borderLeft: "none",
    background: "rgba(255,255,255,0.96)",
    boxShadow: "2px 0 12px -4px rgba(15, 23, 42, 0.12)",
    cursor: "pointer",
    color: "#475569",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box" as const,
  };

  if (railCollapsed) {
    return (
      <button
        type="button"
        aria-label="플랫폼 메뉴 펼치기"
        title="메뉴 펼치기"
        onClick={() => persistRailCollapsed(false)}
        style={{
          ...expandTabStyle,
          paddingLeft: "max(0px, env(safe-area-inset-left, 0px))",
        }}
      >
        <ChevronRightIcon />
      </button>
    );
  }

  return (
    <aside
      className="relative"
      aria-label="플랫폼 내비게이션"
      style={{
        position: "relative",
        zIndex: 40,
        width: RAIL_WIDTH_PX,
        flexShrink: 0,
        alignSelf: "stretch",
        minHeight: 0,
        borderRight: "1px solid #e2e8f0",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        paddingTop: 8,
        paddingBottom: "max(8px, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(6px, env(safe-area-inset-left, 0px))",
        paddingRight: 6,
        boxSizing: "border-box",
      }}
    >
      <ScreenLabel label="공통-상단내비-전체" visible={showScreenLabels} />
      <button
        type="button"
        aria-label="사이드바 접기"
        title="메뉴 접기"
        onClick={() => persistRailCollapsed(true)}
        style={{
          flexShrink: 0,
          width: "100%",
          height: 34,
          marginBottom: 6,
          padding: 0,
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          background: "#f8fafc",
          cursor: "pointer",
          color: "#64748b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxSizing: "border-box",
        }}
      >
        <ChevronLeftIcon />
      </button>

      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          overflow: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {hasProjectContext && effectiveProjectId ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 0, paddingBottom: 6 }}>
            {/* 단계(워크플로) — 최상단 고정 표시 */}
            {hasProjectContext && effectiveProjectId ? (
              <nav
                aria-label="프로젝트 단계"
                style={{ display: "flex", flexDirection: "column", gap: compactToolbar ? 8 : 10, alignItems: "center", width: "100%", flexShrink: 0 }}
              >
                {workflowStepMeta.map((item) => {
                  const href = appFlowStepHref(item.stepId, effectiveProjectId);
                  const active = isWorkflowStepNavActive(item.stepId, pathname, searchParams, effectiveProjectId);
                  const participantKey = appFlowStepIdToRailParticipantKey(item.stepId);
                  const badgeCount = participantKey ? (participantCounts[participantKey] ?? projectMembersCount) : 0;
                  const showBadge =
                    participantKey !== null && participantKey !== "requirements" && badgeCount > 0;
                  return (
                    <Link
                      key={item.stepId}
                      href={href}
                      prefetch={false}
                      aria-label={item.label}
                      title={item.label}
                      style={{
                        ...railIconLinkStyle,
                        border: active ? "2px solid #2563eb" : railIconLinkStyle.border,
                        background: active ? "rgba(37,99,235,0.08)" : railIconLinkStyle.background,
                        color: active ? "#2563eb" : railIconLinkStyle.color,
                        fontSize: 12,
                        fontWeight: 900,
                        position: "relative",
                      }}
                      aria-current={active ? "page" : undefined}
                    >
                      <span aria-hidden style={{ lineHeight: 1, display: "inline-flex" }}>
                        {workflowGlyph(item.label)}
                      </span>
                      {showBadge ? <ProjectRailCountBadge count={badgeCount} /> : null}
                    </Link>
                  );
                })}
              </nav>
            ) : null}

            <div
              aria-hidden
              style={{
                width: 22,
                height: 1,
                background: "rgba(148,163,184,0.55)",
                margin: compactToolbar ? "10px 0" : "12px 0",
                flexShrink: 0,
                borderRadius: 999,
              }}
            />

            {/* 프로젝트 레일 도구: 프로젝트 컨텍스트 전용만 노출 (워크스페이스 레일 아이콘은 숨김) */}
            <div style={{ display: "flex", flexDirection: "column", gap: compactToolbar ? 8 : 10, alignItems: "center", flexShrink: 0 }}>
              <ProjectWorkNoteButton notesProjectId={effectiveProjectId} />
              {Boolean(me) ? (
                <Link
                  href={projectMembersAdminHref(effectiveProjectId)}
                  prefetch={false}
                  aria-label="프로젝트 멤버"
                  title="프로젝트 멤버"
                  style={{ ...railIconLinkStyle, position: "relative" }}
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
                  style={railIconLinkStyle}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                </Link>
              ) : null}
            </div>

            {/* 하단: (의도적으로 비움) */}
          </div>
        ) : (
          <TopRightToolbar
            layout="vertical"
            meReady={meReady}
            me={me}
            avatarLoadFailed={avatarLoadFailed}
            onAvatarError={() => setAvatarLoadFailed(true)}
            hasSession={Boolean(me)}
            compact={compactToolbar}
            workNotesProjectId={projectId?.trim() ? projectId.trim() : null}
            workNotesProjectName={projectName}
            onLogout={handleLogout}
          />
        )}
      </div>
    </aside>
  );
}
