"use client";

import type { CSSProperties } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { uiTokens as t } from "@/components/ui/tokens";
import { DesktopWorkflowTabs } from "@/components/layout/DesktopWorkflowTabs";
import { MobileStepSelector } from "@/components/layout/MobileStepSelector";
import { useWorkNoteComposerInsertHandler } from "@/components/worknote/WorkNoteComposerInsertContext";
import { PromptTimelineDebugButton } from "@/components/debug/PromptTimelineDebugButton";
import { WorkNoteButton } from "@/components/worknote/WorkNoteButton";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { isPromptTimelineDebugClient } from "@/lib/debug/promptTimelineClientFlag";
import {
  appFlowStepHref,
  isWorkflowStepNavActive,
  resolveWorkflowProjectContextId,
} from "@/lib/workflow/flow-state";
import { WORKFLOW_NAV_STRIP_SCREEN_LABEL, workflowStepMeta } from "@/lib/workflow/workflowStepMeta";

type NavItem = { label: string; href: string; screenLabel: string };

function isAdminPathActive(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

const linkMgmt = (active: boolean): CSSProperties => ({
  padding: "5px 11px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: active ? 700 : 600,
  textDecoration: "none",
  whiteSpace: "nowrap",
  border: active ? `1px solid ${t.borderStrong}` : "1px solid transparent",
  background: active ? t.bgPage : "transparent",
  color: active ? t.textSecondary : t.textMuted,
});

/**
 * 프로젝트 컨텍스트가 있을 때만: 워크플로 단계(및 확장 시 프로젝트 관리 링크).
 * 프로젝트 영역(요구사항 헤더·워크플로 페이지 등)에 배치합니다.
 */
function ProjectWorkflowNavInner() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const showScreenLabels = useShowScreenLabels();
  const { effectiveLayout } = useWorkspaceMode();
  const compactWorkflowNav = effectiveLayout === "MOBILE";
  const insertMemoIntoComposer = useWorkNoteComposerInsertHandler();

  const projectContextId = useMemo(
    () => resolveWorkflowProjectContextId(pathname, searchParams),
    [pathname, searchParams]
  );
  const hasProjectContext = Boolean(projectContextId?.trim());

  // Admin links are available via the gear/settings entry point (not primary workflow).
  const admin: NavItem[] = useMemo(() => [], []);

  const workflowItems = useMemo(() => {
    const id = projectContextId?.trim() ?? "";
    if (!id) {
      return [];
    }
    return workflowStepMeta.map((item) => {
      const href = appFlowStepHref(item.stepId, id);
      const active = isWorkflowStepNavActive(item.stepId, pathname, searchParams, id);
      return { ...item, href, active };
    });
  }, [pathname, projectContextId, searchParams]);

  if (!hasProjectContext || !projectContextId) return null;

  const workNote = <WorkNoteButton projectId={projectContextId} onShareToComposer={insertMemoIntoComposer} />;
  const promptTimeline = isPromptTimelineDebugClient() ? <PromptTimelineDebugButton projectId={projectContextId} /> : null;
  const workflowTrailing = (
    <>
      {workNote}
      {promptTimeline}
    </>
  );

  if (compactWorkflowNav) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 6, width: "100%" }}>
        <ScreenLabel label={WORKFLOW_NAV_STRIP_SCREEN_LABEL} visible={showScreenLabels} />
        <MobileStepSelector items={workflowItems} trailingSlot={workflowTrailing} />
      </div>
    );
  }

  return (
    <div
      aria-label="프로젝트 워크플로 및 관리"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 22,
        rowGap: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6, minWidth: 0, flex: "1 1 200px" }}>
        <ScreenLabel label={WORKFLOW_NAV_STRIP_SCREEN_LABEL} visible={showScreenLabels} />
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
          <DesktopWorkflowTabs items={workflowItems} />
          {workflowTrailing}
        </div>
      </div>
      {admin.length ? (
        <>
          <span
            role="separator"
            aria-hidden
            style={{
              width: 2,
              minHeight: 28,
              alignSelf: "stretch",
              margin: "0 2px",
              borderRadius: 999,
              background:
                "linear-gradient(180deg, rgba(148,163,184,0.15) 0%, rgba(100,116,139,0.55) 45%, rgba(148,163,184,0.15) 100%)",
              flexShrink: 0,
            }}
          />
          <nav aria-label="프로젝트 관리" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {admin.map((item) => {
              const base = item.href.split("?")[0] ?? item.href;
              const active = isAdminPathActive(pathname, base);
              return (
                <span key={item.label + item.href} className="relative">
                  <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
                  <Link href={item.href} style={linkMgmt(active)} aria-current={active ? "page" : undefined}>
                    {item.label}
                  </Link>
                </span>
              );
            })}
          </nav>
        </>
      ) : null}
    </div>
  );
}

export function ProjectWorkflowNav() {
  return (
    <Suspense fallback={null}>
      <ProjectWorkflowNavInner />
    </Suspense>
  );
}
