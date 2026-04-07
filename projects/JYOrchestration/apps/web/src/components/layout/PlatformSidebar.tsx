"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type NavItem = {
  label: string;
  href: string;
  disabled?: boolean;
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

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/workspace";
    if (href === "/requirements") return pathname === "/requirements" || pathname.startsWith("/requirements/");
    return pathname === href || pathname.startsWith(href + "/");
  };

  const workflow: NavItem[] = [
    { label: "Requirements", href: "/requirements" },
    { label: "Collaboration", href: "/collaboration" },
    { label: "Features", href: "/features" },
    { label: "Tasks", href: "/tasks" },
  ];
  const execution: NavItem[] = [{ label: "Execution", href: "/execution" }];
  const insight: NavItem[] = [{ label: "Trace", href: "/trace", disabled: false }];
  const project: NavItem[] = [
    { label: "Workspace", href: "/workspace" },
    { label: "Project Admin · Members", href: "/project-admin/members" },
    { label: "Project Admin · Settings", href: "/project-admin/settings" },
    { label: "Project Admin · Policies", href: "/project-admin/policies", disabled: true },
    { label: "Project Admin · Integrations", href: "/project-admin/integrations", disabled: true },
  ];

  return (
    <aside
      aria-label="Platform navigation"
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
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>JY Orchestration</div>

      <SectionTitle>WORKFLOW</SectionTitle>
      <div style={{ display: "grid", gap: 4 }}>
        {workflow.map((item) => (
          <NavLinkItem key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>

      <SectionTitle>EXECUTION</SectionTitle>
      <div style={{ display: "grid", gap: 4 }}>
        {execution.map((item) => (
          <NavLinkItem key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>

      <SectionTitle>INSIGHT</SectionTitle>
      <div style={{ display: "grid", gap: 4 }}>
        {insight.map((item) => (
          <NavLinkItem key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>

      <SectionTitle>PROJECT</SectionTitle>
      <div style={{ display: "grid", gap: 4 }}>
        {project.map((item) => (
          <NavLinkItem key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>
    </aside>
  );
}

