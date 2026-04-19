"use client";

import type { CSSProperties } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import {
  appFlowStepHref,
  isWorkflowStepNavActive,
  resolveWorkflowProjectContextId,
  type AppFlowStepId,
} from "@/lib/workflow/flow-state";

type NavItem = { label: string; href: string; screenLabel: string };

function isAdminPathActive(pathname: string, basePath: string): boolean {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function isTraceNavActive(pathname: string, searchParams: URLSearchParams, contextProjectId: string | null, linkHref: string): boolean {
  if (!(pathname === "/trace" || pathname.startsWith("/trace/"))) return false;
  if (!contextProjectId?.trim()) return true;
  try {
    const u = new URL(linkHref, "http://localhost");
    const want = (u.searchParams.get("projectId") ?? "").trim();
    const got = (searchParams.get("projectId") ?? "").trim();
    return want === got && want === contextProjectId.trim();
  } catch {
    return false;
  }
}

function withProjectQuery(path: string, projectId: string | null): string {
  if (!projectId?.trim()) return path;
  const base = path.split("?")[0] ?? path;
  const existing = path.includes("?") ? path.slice(path.indexOf("?")) : "";
  const sp = new URLSearchParams(existing.replace("?", ""));
  sp.set("projectId", projectId.trim());
  return `${base}?${sp.toString()}`;
}

const WORKFLOW_TOP_NAV: { stepId: AppFlowStepId; label: string; screenLabel: string }[] = [
  { stepId: "requirements", label: "아이디어 구체화", screenLabel: "공통-상단내비-워크플로우-요구사항" },
  { stepId: "features", label: "기능 정리", screenLabel: "공통-상단내비-워크플로우-기능" },
  { stepId: "tasks", label: "작업 정리", screenLabel: "공통-상단내비-워크플로우-작업" },
  { stepId: "planning", label: "생성 준비", screenLabel: "공통-상단내비-워크플로우-실행계획" },
  { stepId: "execution", label: "프로토타입 생성", screenLabel: "공통-상단내비-워크플로우-실행" },
];

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

/**
 * 프로젝트 컨텍스트가 있을 때만: 워크플로 단계 + 프로젝트 멤버/설정 + 추적.
 * 글로벌 상단이 아닌 프로젝트 영역(요구사항 헤더·워크플로 페이지 등)에 배치합니다.
 */
function ProjectWorkflowNavInner() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const showScreenLabels = useShowScreenLabels();

  const projectContextId = useMemo(
    () => resolveWorkflowProjectContextId(pathname, searchParams),
    [pathname, searchParams]
  );
  const hasProjectContext = Boolean(projectContextId?.trim());

  const admin: NavItem[] = useMemo(
    () => [
      { label: "프로젝트 멤버", href: withProjectQuery("/project-admin/members", projectContextId), screenLabel: "공통-상단내비-관리-프로젝트멤버" },
      { label: "설정", href: withProjectQuery("/project-admin/settings", projectContextId), screenLabel: "공통-상단내비-관리-설정" },
    ],
    [projectContextId]
  );

  const traceHref = projectContextId ? appFlowStepHref("trace", projectContextId) : "/trace";
  const insight: NavItem[] = useMemo(
    () => [{ label: "추적", href: traceHref, screenLabel: "공통-상단내비-추적" }],
    [traceHref]
  );

  if (!hasProjectContext || !projectContextId) return null;

  return (
    <div
      aria-label="프로젝트 워크플로 및 관리"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        rowGap: 8,
      }}
    >
      <nav aria-label="프로젝트 워크플로" style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {WORKFLOW_TOP_NAV.map((item) => {
          const href = appFlowStepHref(item.stepId, projectContextId);
          const active = isWorkflowStepNavActive(item.stepId, pathname, searchParams, projectContextId);
          return (
            <span key={item.stepId} className="relative">
              <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
              <Link href={href} style={linkBase(active)} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            </span>
          );
        })}
      </nav>
      <span style={{ width: 1, height: 20, background: "#e2e8f0", flexShrink: 0 }} aria-hidden />
      <nav aria-label="프로젝트 관리" style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {admin.map((item) => {
          const base = item.href.split("?")[0] ?? item.href;
          const active = isAdminPathActive(pathname, base);
          return (
            <span key={item.label + item.href} className="relative">
              <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
              <Link
                href={item.href}
                style={{ ...linkBase(active), fontWeight: 600, color: active ? "#1e40af" : "#64748b" }}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </span>
          );
        })}
      </nav>
      <nav aria-label="인사이트" style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {insight.map((item) => {
          const isActive = isTraceNavActive(pathname, searchParams, projectContextId, item.href);
          return (
            <span key={item.href} className="relative">
              <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
              <Link
                href={item.href}
                style={{ ...linkBase(isActive), fontWeight: 600, color: isActive ? "#1e40af" : "#64748b" }}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            </span>
          );
        })}
      </nav>
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
