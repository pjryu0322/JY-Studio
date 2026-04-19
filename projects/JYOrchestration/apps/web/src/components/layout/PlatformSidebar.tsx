"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ReactNode } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

type NavItem = {
  label: string;
  href: string;
  disabled?: boolean;
  screenLabel: string;
  /** 홈·워크스페이스 별칭·프로젝트 허브(`?view=workspace`)에서 활성 */
  matchHomeAndProjectPlanning?: boolean;
};

function GroupDivider() {
  return (
    <div
      role="separator"
      aria-hidden
      style={{
        height: 1,
        margin: "14px 0",
        background: "#e5e7eb",
        border: 0,
      }}
    />
  );
}

function GroupSectionHeader({
  children,
  screenLabel,
  showScreenLabels,
  dimmed,
}: {
  children: ReactNode;
  screenLabel: string;
  showScreenLabels: boolean;
  /** 그룹 내 항목이 활성일 때 약한 강조 */
  dimmed?: boolean;
}) {
  return (
    <div
      className="relative"
      style={{
        fontSize: 11,
        letterSpacing: 0.4,
        fontWeight: 700,
        color: dimmed ? "#9ca3af" : "#64748b",
        margin: "0 0 6px 2px",
        textTransform: "none" as const,
        userSelect: "none",
      }}
    >
      <ScreenLabel label={screenLabel} visible={showScreenLabels} />
      {children}
    </div>
  );
}

function NavLinkItem({ item, active }: { item: NavItem; active: boolean }) {
  const baseStyle: React.CSSProperties = {
    display: "block",
    padding: "8px 10px",
    borderRadius: 8,
    fontSize: 14,
    color: item.disabled ? "#9ca3af" : active ? "#1e40af" : "#111827",
    background: active ? "#eff6ff" : "transparent",
    border: active ? "1px solid #bfdbfe" : "1px solid transparent",
    textDecoration: "none",
    cursor: item.disabled ? "not-allowed" : "pointer",
    userSelect: "none",
  };

  if (item.disabled) {
    return (
      <div aria-disabled style={baseStyle}>
        {item.label}
      </div>
    );
  }
  return (
    <Link href={item.href} style={baseStyle} aria-current={active ? "page" : undefined}>
      {item.label}
    </Link>
  );
}

function isItemActive(pathname: string, item: NavItem, searchParams: URLSearchParams): boolean {
  if (item.disabled) return false;
  if (item.matchHomeAndProjectPlanning) {
    if (pathname.startsWith("/projects/")) {
      return searchParams.get("view") === "workspace";
    }
    return pathname === "/" || pathname === "/workspace";
  }
  if (item.href === "/requirements") {
    return pathname === "/requirements" || pathname.startsWith("/requirements/");
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function PlatformSidebar() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const showScreenLabels = useShowScreenLabels();

  const projectManagement: NavItem[] = [
    { label: "멤버", href: "/project-admin/members", screenLabel: "공통-사이드바-프로젝트관리-멤버-메뉴" },
    { label: "설정", href: "/project-admin/settings", screenLabel: "공통-사이드바-프로젝트관리-설정-메뉴" },
  ];

  const workflow: NavItem[] = [
    { label: "아이디어 구체화", href: "/requirements", screenLabel: "공통-사이드바-워크플로우-요구사항-메뉴" },
    { label: "협업", href: "/collaboration", screenLabel: "공통-사이드바-워크플로우-협업-메뉴" },
    { label: "기능 정리", href: "/features", screenLabel: "공통-사이드바-워크플로우-기능-메뉴" },
    { label: "작업 정리", href: "/tasks", screenLabel: "공통-사이드바-워크플로우-작업-메뉴" },
    {
      label: "생성 준비",
      href: "/",
      screenLabel: "공통-사이드바-워크플로우-실행계획-메뉴",
      matchHomeAndProjectPlanning: true,
    },
    { label: "프로토타입 생성", href: "/execution", screenLabel: "공통-사이드바-워크플로우-실행-메뉴" },
  ];

  const insight: NavItem[] = [
    { label: "추적", href: "/trace", disabled: false, screenLabel: "공통-사이드바-인사이트-추적-메뉴" },
  ];

  const workflowGroupActive = workflow.some((item) => isItemActive(pathname, item, searchParams));
  const projectGroupActive = projectManagement.some((item) => isItemActive(pathname, item, searchParams));
  const insightGroupActive = insight.some((item) => isItemActive(pathname, item, searchParams));

  return (
    <aside
      aria-label="플랫폼 내비게이션"
      className="relative"
      style={{
        width: 260,
        flex: "0 0 260px",
        borderRight: "1px solid #e5e5e5",
        padding: 16,
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "auto",
        background: "var(--background)",
      }}
    >
      <ScreenLabel label="공통-사이드바-전체-패널" visible={showScreenLabels} />
      <div className="relative" style={{ fontSize: 14, fontWeight: 800, marginBottom: 12 }}>
        <ScreenLabel label="공통-사이드바-제목-섹션" visible={showScreenLabels} />
        JY Orchestration
      </div>

      {/* 1 — 프로젝트 관리 */}
      <div
        style={{
          padding: "8px 8px 10px",
          borderRadius: 10,
          background: projectGroupActive ? "rgba(239, 246, 255, 0.55)" : "transparent",
          border: projectGroupActive ? "1px solid #e0e7ff" : "1px solid transparent",
        }}
      >
        <GroupSectionHeader
          screenLabel="공통-사이드바-프로젝트관리-그룹-헤더"
          showScreenLabels={showScreenLabels}
          dimmed={!projectGroupActive}
        >
          프로젝트 관리
        </GroupSectionHeader>
        <div style={{ display: "grid", gap: 4 }}>
          {projectManagement.map((item) => (
            <div key={item.href} className="relative">
              <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
              <NavLinkItem item={item} active={isItemActive(pathname, item, searchParams)} />
            </div>
          ))}
        </div>
      </div>

      <GroupDivider />

      {/* 2 — 워크플로우 */}
      <div
        style={{
          padding: "8px 8px 10px",
          borderRadius: 10,
          background: workflowGroupActive ? "rgba(239, 246, 255, 0.45)" : "transparent",
          border: workflowGroupActive ? "1px solid #e0e7ff" : "1px solid transparent",
        }}
      >
        <GroupSectionHeader
          screenLabel="공통-사이드바-워크플로우-그룹-헤더"
          showScreenLabels={showScreenLabels}
          dimmed={!workflowGroupActive}
        >
          워크플로우
        </GroupSectionHeader>
        <div style={{ display: "grid", gap: 4 }}>
          {workflow.map((item) => (
            <div key={item.href + item.label} className="relative">
              <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
              <NavLinkItem item={item} active={isItemActive(pathname, item, searchParams)} />
            </div>
          ))}
        </div>
      </div>

      <GroupDivider />

      {/* 3 — 인사이트 */}
      <div
        style={{
          padding: "8px 8px 10px",
          borderRadius: 10,
          background: insightGroupActive ? "rgba(239, 246, 255, 0.45)" : "transparent",
          border: insightGroupActive ? "1px solid #e0e7ff" : "1px solid transparent",
        }}
      >
        <GroupSectionHeader
          screenLabel="공통-사이드바-인사이트-그룹-헤더"
          showScreenLabels={showScreenLabels}
          dimmed={!insightGroupActive}
        >
          인사이트
        </GroupSectionHeader>
        <div style={{ display: "grid", gap: 4 }}>
          {insight.map((item) => (
            <div key={item.href} className="relative">
              <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
              <NavLinkItem item={item} active={isItemActive(pathname, item, searchParams)} />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
