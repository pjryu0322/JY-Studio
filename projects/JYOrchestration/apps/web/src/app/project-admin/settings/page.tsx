"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchProjectById } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";
import { ProjectExecutionEnvironmentPanel } from "@/components/project/ProjectExecutionEnvironmentPanel";
import { ProjectPrototypePreviewSettingsPanel } from "@/components/project/ProjectPrototypePreviewSettingsPanel";
import { PrototypeEnvSettingsPreviewCollapsible } from "@/components/project/prototypeEnvSettingsUx";
import {
  PROJECT_ADMIN_EXECUTION_SETUP_PANEL_ID,
  scrollProjectAdminExecutionSetupPanelIntoView,
} from "@/lib/project/projectAdminSettingsScroll";
import { canEditSpec } from "@/lib/rbac/projectPermissions";
import type { ProjectRole } from "@/lib/rbac/projectPermissions";

function ProjectAdminSettingsInner() {
  const searchParams = useSearchParams();
  const projectId = String(searchParams.get("projectId") ?? "").trim();
  const scrollRef = useRef<HTMLDivElement>(null);

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
    [projectRole],
  );

  useEffect(() => {
    if (!projectId) return;
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#execution-setup-panel") return;
    const t = window.setTimeout(() => {
      scrollProjectAdminExecutionSetupPanelIntoView(scrollRef.current);
    }, 0);
    return () => window.clearTimeout(t);
  }, [projectId, project]);

  return (
    <main data-testid="project-admin-settings-page" className="jyo-project-admin-settings-page">
      <div ref={scrollRef} className="jyo-project-admin-settings-scroll" data-testid="project-admin-settings-scroll">
        <div className="jyo-project-admin-settings-content">
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
              <div id={PROJECT_ADMIN_EXECUTION_SETUP_PANEL_ID} style={{ minWidth: 0, maxWidth: "100%" }}>
                <ProjectExecutionEnvironmentPanel
                  projectId={projectId}
                  project={project}
                  canEdit={rbac.canEditSpec}
                  canRevealCursorApiKey={projectRole === "OWNER"}
                  settingsSurface="admin"
                  settingsPurpose="prototype"
                />
              </div>
              <PrototypeEnvSettingsPreviewCollapsible>
                <ProjectPrototypePreviewSettingsPanel projectId={projectId} />
              </PrototypeEnvSettingsPreviewCollapsible>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function ProjectAdminSettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="jyo-project-admin-settings-page" data-testid="project-admin-settings-page">
          <div className="jyo-project-admin-settings-scroll">
            <div className="jyo-project-admin-settings-content" style={{ color: "#64748b" }}>
              불러오는 중…
            </div>
          </div>
        </main>
      }
    >
      <ProjectAdminSettingsInner />
    </Suspense>
  );
}
