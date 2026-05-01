"use client";

import type { CSSProperties } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { uiTokens as t } from "@/components/ui/tokens";
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
  { stepId: "prototype_review", label: "프로토타입 검토", screenLabel: "공통-상단내비-워크플로우-프로토타입검토" },
];

const linkProcess = (active: boolean): CSSProperties => ({
  padding: "7px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
  border: active ? `1px solid ${t.primary}` : `1px solid ${t.border}`,
  background: active ? `${t.primary}14` : t.bgCard,
  color: active ? t.primary : t.textSecondary,
});

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
  const [narrow, setNarrow] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const projectContextId = useMemo(
    () => resolveWorkflowProjectContextId(pathname, searchParams),
    [pathname, searchParams]
  );
  const hasProjectContext = Boolean(projectContextId?.trim());

  // Admin links are available via the gear/settings entry point (not primary workflow).
  const admin: NavItem[] = useMemo(() => [], []);

  if (!hasProjectContext || !projectContextId) return null;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    const onChange = () => {
      apply();
      setSheetOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const workflowItems = useMemo(() => {
    return WORKFLOW_TOP_NAV.map((item) => {
      const href = appFlowStepHref(item.stepId, projectContextId);
      const active = isWorkflowStepNavActive(item.stepId, pathname, searchParams, projectContextId);
      return { ...item, href, active };
    });
  }, [pathname, projectContextId, searchParams]);

  const activeWorkflowLabel = useMemo(() => {
    return workflowItems.find((x) => x.active)?.label ?? "단계";
  }, [workflowItems]);

  if (narrow) {
    return (
      <div aria-label="프로젝트 워크플로 및 관리" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div className="relative" style={{ position: "relative", minWidth: 0 }}>
          <ScreenLabel label="공통-상단내비-워크플로우-현재단계" visible={showScreenLabels} />
          <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeWorkflowLabel}
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: `1px solid ${t.border}`,
              background: "#fff",
              fontSize: 12.5,
              fontWeight: 900,
              color: t.textSecondary,
              cursor: "pointer",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
            }}
          >
            단계 변경
          </button>
        </div>

        {sheetOpen ? (
          <>
            <button
              type="button"
              aria-label="단계 변경 닫기"
              onClick={() => setSheetOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 75,
                border: 0,
                padding: 0,
                margin: 0,
                background: "rgba(15, 23, 42, 0.35)",
                cursor: "pointer",
              }}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="프로젝트 단계 변경"
              style={{
                position: "fixed",
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 76,
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                borderTop: `1px solid ${t.border}`,
                background: "#fff",
                padding: "10px 12px 18px",
                boxShadow: "0 -8px 32px rgba(15, 23, 42, 0.12)",
                maxHeight: "min(70vh, 420px)",
                overflowY: "auto",
              }}
            >
              <div style={{ width: 40, height: 4, borderRadius: 999, background: "#e2e8f0", margin: "4px auto 12px" }} aria-hidden />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>단계 변경</div>
                <button
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  style={{ border: 0, background: "transparent", color: t.textMuted, fontWeight: 900, cursor: "pointer", padding: "6px 8px", fontSize: 13 }}
                >
                  닫기
                </button>
              </div>
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {workflowItems.map((item) => (
                  <span key={item.stepId} className="relative">
                    <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
                    <Link
                      href={item.href}
                      onClick={() => setSheetOpen(false)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        width: "100%",
                        textAlign: "left",
                        padding: "11px 14px",
                        borderRadius: 12,
                        textDecoration: "none",
                        border: item.active ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
                        background: item.active ? `${t.primary}14` : "#fff",
                        color: "#0f172a",
                        fontSize: 14,
                        fontWeight: 800,
                        boxSizing: "border-box",
                      }}
                      aria-current={item.active ? "page" : undefined}
                    >
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      {item.active ? <span style={{ fontSize: 12, fontWeight: 900, color: t.primary }}>현재</span> : null}
                    </Link>
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : null}
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
      <nav aria-label="프로젝트 단계" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        {workflowItems.map((item) => {
          return (
            <span key={item.stepId} className="relative">
              <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
              <Link href={item.href} style={linkProcess(item.active)} aria-current={item.active ? "page" : undefined}>
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
