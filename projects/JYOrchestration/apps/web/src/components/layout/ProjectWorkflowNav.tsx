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

// User-facing primary workflow: keep it minimal.
const WORKFLOW_TOP_NAV: { stepId: AppFlowStepId; label: string; screenLabel: string }[] = [
  { stepId: "requirements", label: "아이디어 구체화", screenLabel: "공통-상단내비-워크플로우-요구사항" },
  { stepId: "service_flow", label: "액터 및 서비스 흐름 정의", screenLabel: "공통-상단내비-워크플로우-서비스흐름" },
  { stepId: "features", label: "기능 정리", screenLabel: "공통-상단내비-워크플로우-기능" },
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
 * 프로젝트 컨텍스트가 있을 때만: 워크플로 단계(및 확장 시 프로젝트 관리 링크).
 * 프로젝트 영역(요구사항 헤더·워크플로 페이지 등)에 배치합니다.
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

  // Admin links are available via the gear/settings entry point (not primary workflow).
  const admin: NavItem[] = useMemo(() => [], []);

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
