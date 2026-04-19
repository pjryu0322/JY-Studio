"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

type NavItem = {
  label: string;
  href: string;
  disabled?: boolean;
  screenLabel: string;
  matchHomeAndProjectPlanning?: boolean;
};

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

export function PlatformTopNav() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const showScreenLabels = useShowScreenLabels();

  const workflow: NavItem[] = [
    { label: "아이디어 구체화", href: "/requirements", screenLabel: "공통-상단내비-워크플로우-요구사항" },
    { label: "기능 정리", href: "/features", screenLabel: "공통-상단내비-워크플로우-기능" },
    { label: "작업 정리", href: "/tasks", screenLabel: "공통-상단내비-워크플로우-작업" },
    {
      label: "생성 준비",
      href: "/",
      screenLabel: "공통-상단내비-워크플로우-실행계획",
      matchHomeAndProjectPlanning: true,
    },
    { label: "프로토타입 생성", href: "/execution", screenLabel: "공통-상단내비-워크플로우-실행" },
  ];

  const admin: NavItem[] = [
    { label: "멤버", href: "/project-admin/members", screenLabel: "공통-상단내비-관리-멤버" },
    { label: "설정", href: "/project-admin/settings", screenLabel: "공통-상단내비-관리-설정" },
  ];

  const insight: NavItem[] = [{ label: "추적", href: "/trace", screenLabel: "공통-상단내비-추적" }];

  const linkBase = (active: boolean): CSSProperties => ({
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
    whiteSpace: "nowrap",
    border: active ? "1px solid #bfdbfe" : "1px solid transparent",
    background: active ? "#eff6ff" : "transparent",
    color: active ? "#1e40af" : "#334155",
  });

  return (
    <header
      className="relative"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        borderBottom: "1px solid #e2e8f0",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
      }}
    >
      <ScreenLabel label="공통-상단내비-전체" visible={showScreenLabels} />
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "10px 20px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          rowGap: 8,
        }}
      >
        <Link
          href="/"
          style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", textDecoration: "none", marginRight: 8, letterSpacing: "-0.02em" }}
        >
          JY Orchestration
        </Link>
        <span style={{ width: 1, height: 22, background: "#e2e8f0", flexShrink: 0 }} aria-hidden />
        <nav aria-label="워크플로" style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          {workflow.map((item) => {
            const active = isItemActive(pathname, item, searchParams);
            return (
              <span key={item.href + item.label} className="relative">
                <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
                {item.disabled ? (
                  <span style={{ ...linkBase(false), color: "#94a3b8", cursor: "not-allowed" }}>{item.label}</span>
                ) : (
                  <Link href={item.href} style={linkBase(active)} aria-current={active ? "page" : undefined}>
                    {item.label}
                  </Link>
                )}
              </span>
            );
          })}
        </nav>
        <span style={{ flex: 1, minWidth: 8 }} aria-hidden />
        <nav aria-label="프로젝트 관리" style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
          {admin.map((item) => {
            const active = isItemActive(pathname, item, searchParams);
            return (
              <span key={item.href} className="relative">
                <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
                <Link href={item.href} style={{ ...linkBase(active), fontWeight: 600, color: active ? "#1e40af" : "#64748b" }} aria-current={active ? "page" : undefined}>
                  {item.label}
                </Link>
              </span>
            );
          })}
        </nav>
        <nav aria-label="인사이트" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {insight.map((item) => {
            const active = isItemActive(pathname, item, searchParams);
            return (
              <span key={item.href} className="relative">
                <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
                <Link href={item.href} style={{ ...linkBase(active), fontWeight: 600, color: active ? "#1e40af" : "#64748b" }} aria-current={active ? "page" : undefined}>
                  {item.label}
                </Link>
              </span>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
