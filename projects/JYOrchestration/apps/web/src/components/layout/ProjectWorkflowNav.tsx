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

/**
 * MVP: 프로젝트 워크플로 스트립에서 「추적」 비노출(`/trace` 라우트·기능은 유지).
 * 재도입 시 `true`로 변경하면 아래 `insight` 네비가 다시 렌더됩니다.
 */
const SHOW_PROJECT_TRACE_NAV = false;

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
  { stepId: "service_flow", label: "액터 및 서비스 흐름 정의", screenLabel: "공통-상단내비-워크플로우-서비스흐름" },
  { stepId: "features", label: "기능 정리", screenLabel: "공통-상단내비-워크플로우-기능" },
  { stepId: "tasks", label: "작업 정리", screenLabel: "공통-상단내비-워크플로우-작업" },
  { stepId: "planning", label: "생성 준비", screenLabel: "공통-상단내비-워크플로우-실행계획" },
  { stepId: "execution", label: "프로토타입 생성", screenLabel: "공통-상단내비-워크플로우-실행" },
];

const linkProcess = (active: boolean): CSSProperties => ({
  padding: "7px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
  whiteSpace: "nowrap",
  border: active ? "1px solid #bfdbfe" : "1px solid transparent",
  background: active ? "#eff6ff" : "transparent",
  color: active ? "#1e40af" : "#334155",
});

const linkMgmt = (active: boolean): CSSProperties => ({
  padding: "5px 11px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: active ? 600 : 500,
  textDecoration: "none",
  whiteSpace: "nowrap",
  border: active ? "1px solid #e2e8f0" : "1px solid transparent",
  background: active ? "#f8fafc" : "transparent",
  color: active ? "#475569" : "#a1a1aa",
});

/**
 * 프로젝트 컨텍스트가 있을 때만: 워크플로 단계 + 프로젝트 멤버/설정 (+ 옵션: 추적).
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

  const insight: NavItem[] = useMemo(() => {
    if (!SHOW_PROJECT_TRACE_NAV) return [];
    return [{ label: "추적", href: withProjectQuery("/trace", projectContextId), screenLabel: "공통-상단내비-추적" }];
  }, [projectContextId]);

  if (!hasProjectContext || !projectContextId) return null;

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
      <nav aria-label="프로젝트 단계" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {WORKFLOW_TOP_NAV.map((item) => {
          const href = appFlowStepHref(item.stepId, projectContextId);
          const active = isWorkflowStepNavActive(item.stepId, pathname, searchParams, projectContextId);
          return (
            <span key={item.stepId} className="relative">
              <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
              <Link href={href} style={linkProcess(active)} aria-current={active ? "page" : undefined}>
                {item.label}
              </Link>
            </span>
          );
        })}
      </nav>
      <span
        role="separator"
        aria-hidden
        style={{
          width: 2,
          minHeight: 28,
          alignSelf: "stretch",
          margin: "0 2px",
          borderRadius: 999,
          background: "linear-gradient(180deg, rgba(148,163,184,0.15) 0%, rgba(100,116,139,0.55) 45%, rgba(148,163,184,0.15) 100%)",
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
              <Link
                href={item.href}
                style={linkMgmt(active)}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </span>
          );
        })}
      </nav>
      {SHOW_PROJECT_TRACE_NAV ? (
        <nav aria-label="인사이트" style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
          {insight.map((item) => {
            const isActive = isTraceNavActive(pathname, searchParams, projectContextId, item.href);
            return (
              <span key={item.href} className="relative">
                <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
                <Link
                  href={item.href}
                  style={linkMgmt(isActive)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </span>
            );
          })}
        </nav>
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
