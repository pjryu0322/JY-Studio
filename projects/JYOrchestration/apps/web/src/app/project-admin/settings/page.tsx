"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchProjectById } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";
import { ProjectExecutionEnvironmentPanel } from "@/components/project/ProjectExecutionEnvironmentPanel";
import { canEditSpec } from "@/lib/rbac/projectPermissions";
import type { ProjectRole } from "@/lib/rbac/projectPermissions";
function ProjectAdminSettingsInner() {
  const searchParams = useSearchParams();
  const projectId = String(searchParams.get("projectId") ?? "").trim();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projectRole, setProjectRole] = useState<ProjectRole | null>(null);

  const reloadSessionContext = useCallback(async () => {
    if (!projectId) {
      setProjectRole(null);
      return;
    }
    const res = await fetch(`/api/project/session-context?projectId=${encodeURIComponent(projectId)}`, {
      credentials: "include",
    });
    const json = (await res.json()) as {
      success: boolean;
      data?: { myRole: ProjectRole | null };
    };
    if (!res.ok || !json.success || !json.data) {
      setProjectRole(null);
      return;
    }
    setProjectRole(json.data.myRole);
  }, [projectId]);

  useEffect(() => {
    const t = window.setTimeout(() => void reloadSessionContext(), 0);
    return () => window.clearTimeout(t);
  }, [reloadSessionContext]);

  useEffect(() => {
    if (!projectId) {
      const t = window.setTimeout(() => {
        setProject(null);
        setErrorMessage(null);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(t);
      return;
    }
    let cancelled = false;
    window.setTimeout(() => {
      if (!cancelled) {
        setLoading(true);
        setErrorMessage(null);
      }
    }, 0);
    void (async () => {
      const { project: p, errorMessage: err } = await fetchProjectById(projectId);
      if (cancelled) return;
      window.setTimeout(() => {
        if (!cancelled) setLoading(false);
      }, 0);
      if (err || !p) {
        window.setTimeout(() => {
          if (!cancelled) {
            setProject(null);
            setErrorMessage(err || "프로젝트를 불러오지 못했습니다.");
          }
        }, 0);
        return;
      }
      window.setTimeout(() => {
        if (!cancelled) setProject(p);
      }, 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const rbac = useMemo(
    () => ({
      canEditSpec: canEditSpec(projectRole),
    }),
    [projectRole]
  );

  const backHref = projectId
    ? `/requirements?projectId=${encodeURIComponent(projectId)}&stage=service-flow&preview=1`
    : "/";

  useEffect(() => {
    if (!projectId) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#execution-setup-panel") return;
    const t = window.setTimeout(() => {
      const el = document.getElementById("execution-setup-panel");
      if (!el) return;
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      if (el instanceof HTMLElement) {
        if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
        el.focus({ preventScroll: true });
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [projectId]);

  return (
    <main data-testid="project-admin-settings-page" style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <Link
          href={backHref}
          style={{ fontSize: 14, fontWeight: 700, color: "#1d4ed8", textDecoration: "none" }}
        >
          ← 프로토타입 미리보기로 돌아가기
        </Link>
      </div>

      {!projectId ? (
        <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 10px 0" }}>
            프로젝트가 선택되지 않았습니다.{" "}
            <Link href="/" style={{ color: "#1d4ed8", fontWeight: 700 }}>
              프로젝트 목록
            </Link>
            에서 프로젝트를 연 뒤, 실행 준비 요약의 <strong>설정으로 이동</strong>을 이용하세요.
          </p>
        </div>
      ) : null}

      {projectId && loading ? <p style={{ color: "#64748b" }}>불러오는 중…</p> : null}
      {projectId && errorMessage ? (
        <p style={{ color: "#b91c1c", fontWeight: 600 }} role="alert">
          {errorMessage}
        </p>
      ) : null}

      {projectId && project && !errorMessage ? (
        <>
          <header style={{ marginBottom: 12 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
              프로토타입 자동 생성 환경설정
            </h1>
          </header>

          <div id="execution-setup-panel">
            <ProjectExecutionEnvironmentPanel
              projectId={projectId}
              project={project}
              canEdit={rbac.canEditSpec}
              canRevealCursorApiKey={projectRole === "OWNER"}
              settingsSurface="admin"
              settingsPurpose="prototype"
            />
          </div>
        </>
      ) : null}
    </main>
  );
}

export default function ProjectAdminSettingsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, maxWidth: 960, margin: "0 auto", color: "#64748b" }}>불러오는 중…</div>
      }
    >
      <ProjectAdminSettingsInner />
    </Suspense>
  );
}
