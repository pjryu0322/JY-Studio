"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

type NavItem = {
  label: string;
  href: string;
  disabled?: boolean;
  screenLabel: string;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, letterSpacing: 0.6, fontWeight: 700, color: "#6b7280", margin: "16px 0 8px" }}>
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

export function PlatformSidebar() {
  const pathname = usePathname() || "/";
  const showScreenLabels = useShowScreenLabels();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/workspace";
    if (href === "/requirements") return pathname === "/requirements" || pathname.startsWith("/requirements/");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const workflow: NavItem[] = [
    { label: "요구사항", href: "/requirements", screenLabel: "공통-사이드바-요구사항-메뉴" },
    { label: "협업", href: "/collaboration", screenLabel: "공통-사이드바-협업-메뉴" },
    { label: "기능", href: "/features", screenLabel: "공통-사이드바-기능-메뉴" },
    { label: "작업", href: "/tasks", screenLabel: "공통-사이드바-작업-메뉴" },
  ];
  const execution: NavItem[] = [{ label: "실행", href: "/execution", screenLabel: "공통-사이드바-실행-메뉴" }];
  const insight: NavItem[] = [{ label: "추적", href: "/trace", disabled: false, screenLabel: "공통-사이드바-추적-메뉴" }];
  const project: NavItem[] = [
    { label: "워크스페이스", href: "/workspace", screenLabel: "공통-사이드바-워크스페이스-메뉴" },
    { label: "프로젝트 관리 · 멤버", href: "/project-admin/members", screenLabel: "공통-사이드바-프로젝트관리-멤버-메뉴" },
    { label: "프로젝트 관리 · 설정", href: "/project-admin/settings", screenLabel: "공통-사이드바-프로젝트관리-설정-메뉴" },
    {
      label: "프로젝트 관리 · 정책",
      href: "/project-admin/policies",
      disabled: true,
      screenLabel: "공통-사이드바-프로젝트관리-정책-메뉴",
    },
    {
      label: "프로젝트 관리 · 연동",
      href: "/project-admin/integrations",
      disabled: true,
      screenLabel: "공통-사이드바-프로젝트관리-연동-메뉴",
    },
  ];

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
      <div className="relative" style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
        <ScreenLabel label="공통-사이드바-제목-섹션" visible={showScreenLabels} />
        JY Orchestration
      </div>

      <div className="relative">
        <ScreenLabel label="공통-사이드바-워크플로우흐름-섹션" visible={showScreenLabels} />
        <SectionTitle>워크플로우 흐름</SectionTitle>
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {workflow.map((item) => (
          <div key={item.href} className="relative">
            <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
            <NavLinkItem item={item} active={isActive(item.href)} />
          </div>
        ))}
      </div>

      <div className="relative">
        <ScreenLabel label="공통-사이드바-실행구역-섹션" visible={showScreenLabels} />
        <SectionTitle>실행</SectionTitle>
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {execution.map((item) => (
          <div key={item.href} className="relative">
            <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
            <NavLinkItem item={item} active={isActive(item.href)} />
          </div>
        ))}
      </div>

      <div className="relative">
        <ScreenLabel label="공통-사이드바-추적구역-섹션" visible={showScreenLabels} />
        <SectionTitle>추적</SectionTitle>
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {insight.map((item) => (
          <div key={item.href} className="relative">
            <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
            <NavLinkItem item={item} active={isActive(item.href)} />
          </div>
        ))}
      </div>

      <div className="relative">
        <ScreenLabel label="공통-사이드바-프로젝트구역-섹션" visible={showScreenLabels} />
        <SectionTitle>프로젝트</SectionTitle>
      </div>
      <div style={{ display: "grid", gap: 4 }}>
        {project.map((item) => (
          <div key={item.href} className="relative">
            <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
            <NavLinkItem item={item} active={isActive(item.href)} />
          </div>
        ))}
      </div>
    </aside>
  );
}
