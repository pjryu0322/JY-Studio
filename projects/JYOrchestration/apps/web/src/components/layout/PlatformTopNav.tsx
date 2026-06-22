"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TopRightToolbar } from "@/components/layout/TopRightToolbar";
import { useProjectRailBadges } from "@/components/layout/useProjectRailBadges";
import { useProjectWorkNotesRailCount } from "@/components/layout/useProjectWorkNotesRailCount";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/layout/platformTopNav/PlatformTopNavChevrons";
import { ProjectRailSecondaryTools } from "@/components/layout/platformTopNav/ProjectRailSecondaryTools";
import { ProjectRailWorkflowStrip } from "@/components/layout/platformTopNav/ProjectRailWorkflowStrip";
import { useProjectNameFromId } from "@/lib/project/useProjectNameFromId";
import { usePlatformRailCollapsed } from "@/components/layout/platformTopNav/usePlatformRailCollapsed";
import { usePlatformTopNavAuth } from "@/components/layout/platformTopNav/usePlatformTopNavAuth";
import { resolveEffectiveWorkflowProjectId } from "@/lib/layout/effectiveWorkflowProjectId";
import {
  PLATFORM_RAIL_EXPAND_TAB_W,
  PLATFORM_RAIL_WIDTH_PX,
  platformRailCollapseEdgeTabStyle,
  platformRailExpandTabStyle,
} from "@/lib/layout/platformTopNavConstants";
import { resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";

export function PlatformTopNav() {
  const { effectiveLayout } = useWorkspaceMode();
  const [layoutHydrated, setLayoutHydrated] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- WorkspaceMode 클라이언트 레이아웃 확정 후 compact 여부 반영
    setLayoutHydrated(true);
  }, []);
  const compactToolbar = layoutHydrated && effectiveLayout === "MOBILE";  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [railCollapsed, persistRailCollapsed] = usePlatformRailCollapsed();
  const { me, meReady, avatarLoadFailed, setAvatarLoadFailed, logout } = usePlatformTopNavAuth(pathname);

  const projectId = useMemo(
    () => resolveWorkflowProjectContextId(pathname, searchParams),
    [pathname, searchParams]
  );
  const effectiveProjectId = useMemo(
    () => resolveEffectiveWorkflowProjectId(pathname, searchParams),
    [pathname, searchParams]
  );
  const hasProjectContext = Boolean(effectiveProjectId?.trim());
  const { participantCounts, memberCount: projectMembersCount } = useProjectRailBadges(effectiveProjectId);
  const projectWorkNotesCount = useProjectWorkNotesRailCount(effectiveProjectId);
  const projectName = useProjectNameFromId(projectId);

  const expandTabBase = platformRailExpandTabStyle(PLATFORM_RAIL_EXPAND_TAB_W);

  if (railCollapsed) {
    return (
      <button
        type="button"
        aria-label="플랫폼 메뉴 펼치기"
        title="메뉴 펼치기"
        onClick={() => persistRailCollapsed(false)}
        style={{
          ...expandTabBase,
          paddingLeft: "max(0px, env(safe-area-inset-left, 0px))",
        }}
      >
        <ChevronRightIcon size={15} />
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
        width: PLATFORM_RAIL_WIDTH_PX,
        flexShrink: 0,
        alignSelf: "stretch",
        minHeight: 0,
        borderRight: "1px solid #e2e8f0",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        paddingTop: 4,
        paddingBottom: "max(4px, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(6px, env(safe-area-inset-left, 0px))",
        paddingRight: 12,
        boxSizing: "border-box",
      }}
    >      <button
        type="button"
        aria-label="사이드바 접기"
        title="메뉴 접기"
        onClick={() => persistRailCollapsed(true)}
        style={platformRailCollapseEdgeTabStyle()}
      >
        <ChevronLeftIcon size={15} />
      </button>

      <div
        style={{
          flex: "1 1 auto",
          minHeight: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          overflow: "hidden",
          overscrollBehavior: "none",
        }}
      >
        {hasProjectContext && effectiveProjectId ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minHeight: 0, paddingBottom: 4 }}>
            <ProjectRailWorkflowStrip
              effectiveProjectId={effectiveProjectId}
              pathname={pathname}
              searchParams={searchParams}
              compactToolbar={compactToolbar}
              participantCounts={participantCounts}
              projectMembersCount={projectMembersCount}
            />

            <div
              aria-hidden
              style={{
                width: 22,
                height: 1,
                background: "rgba(148,163,184,0.55)",
                margin: compactToolbar ? "4px 0" : "6px 0",
                flexShrink: 0,
                borderRadius: 999,
              }}
            />

            <ProjectRailSecondaryTools
              effectiveProjectId={effectiveProjectId}
              compactToolbar={compactToolbar}
              meReady={meReady}
              me={me}
              projectMembersCount={projectMembersCount}
              projectWorkNotesCount={projectWorkNotesCount}
            />
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
            onLogout={logout}
          />
        )}
      </div>
    </aside>
  );
}
