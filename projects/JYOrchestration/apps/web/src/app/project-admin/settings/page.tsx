"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchProjectById } from "@/components/project-spec/api";
import type { Project } from "@/components/project-spec/types";
import { ProjectWorkflowNav } from "@/components/layout/ProjectWorkflowNav";
import { ProjectExecutionEnvironmentPanel } from "@/components/project/ProjectExecutionEnvironmentPanel";
import { ProjectAdminWorkflowScopeNote } from "@/components/project/ProjectAdminWorkflowScopeNote";
import { canEditSpec } from "@/lib/rbac/projectPermissions";
import type { ProjectRole } from "@/lib/rbac/projectPermissions";
function ProjectAdminSettingsInner() {
  const searchParams = useSearchParams();
  const projectId = String(searchParams.get("projectId") ?? "").trim();
  const envNoteRaw = searchParams.get("envNote");
  const envNote = envNoteRaw != null && String(envNoteRaw).trim() ? String(envNoteRaw).trim() : null;
  const isPrototypePurpose = envNote === "prototype";

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

  const backHref = projectId ? `/projects/${encodeURIComponent(projectId)}?view=workspace` : "/";

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

      {projectId ? (
        <div style={{ marginBottom: 14 }}>
          <ProjectWorkflowNav />
        </div>
      ) : null}

      {isPrototypePurpose ? null : <ProjectAdminWorkflowScopeNote />}

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
            <h1 style={{ margin: "0 0 6px 0", fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
              프로토타입 자동 생성 환경설정
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>
              Git·GitHub·Cursor 연결과 자동 실행 정책/검증을 설정합니다.
            </p>
          </header>

          {isPrototypePurpose ? (
            <details style={{ marginBottom: 10 }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, color: "#475569", fontWeight: 800 }}>
                설정 도움말 보기
              </summary>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 12.5,
                  color: "#475569",
                  lineHeight: 1.55,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <strong style={{ color: "#0f172a" }}>순서</strong> — ① Git 저장소 ② GitHub 인증 ③ Cursor API ④ 실행 정책
                ⑤ 환경 검증
              </div>
            </details>
          ) : (
            <section aria-labelledby="settings-env-sections" style={{ marginBottom: 14 }}>
              <h2
                id="settings-env-sections"
                style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}
              >
                환경 준비
              </h2>
              <div
                style={{
                  fontSize: 13,
                  color: "#475569",
                  lineHeight: 1.55,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <strong style={{ color: "#0f172a" }}>구성</strong> — ① <strong>연결 설정</strong>(Git 저장소·GitHub
                토큰·Cursor API) ② <strong>실행 정책</strong>(승인·푸시·재시도 등) ③ <strong>환경 검증</strong>(저장소·Cursor
                접근·권한)은 아래 패널에서 진행합니다.
              </div>
            </section>
          )}

          <ProjectExecutionEnvironmentPanel
            projectId={projectId}
            project={project}
            canEdit={rbac.canEditSpec}
            canRevealCursorApiKey={projectRole === "OWNER"}
            settingsSurface="admin"
            settingsPurpose={isPrototypePurpose ? "prototype" : "env-test"}
          />
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
