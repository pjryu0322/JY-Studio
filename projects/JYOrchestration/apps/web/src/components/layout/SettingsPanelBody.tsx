"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUiLabel } from "@/lib/ui-label/useUiLabel";
import { useGlobalPreferences } from "@/lib/preferences/useGlobalPreferences";
import { projectExecutionSettingsHref } from "@/lib/project/projectExecutionSettingsHref";
import { projectMembersAdminHref } from "@/lib/project/projectMembersAdminHref";
import { resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";
import { WorkspaceModeSwitcher } from "@/components/layout/WorkspaceModeSwitcher";

function sectionTitle(text: string, opts?: { first?: boolean }) {
  return (
    <p
      style={{
        margin: opts?.first ? "0 0 8px 0" : "14px 0 8px 0",
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        color: "#94a3b8",
        textTransform: "uppercase",
      }}
    >
      {text}
    </p>
  );
}

function row(label: string, control: ReactNode) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 36,
        padding: "4px 0",
        borderBottom: "1px solid #f1f5f9",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", flex: "1 1 auto", minWidth: 0 }}>{label}</span>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}

const linkStyle: CSSProperties = { fontSize: 12, fontWeight: 800, color: "#2563eb", textDecoration: "none" };

/** 플랫폼 설정 본문(`/settings` 페이지 및 기타에서 재사용). */
export function SettingsPanelBody() {
  const { enabled, setEnabled, ready } = useUiLabel();
  const prefs = useGlobalPreferences();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [sessionPresent, setSessionPresent] = useState(false);
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  const projectId = resolveWorkflowProjectContextId(pathname, searchParams);
  const pid = projectId?.trim() ?? "";
  const encodedProjectId = pid ? encodeURIComponent(pid) : "";
  const hasProjectContext = Boolean(pid);
  const projectSettingsHref = hasProjectContext
    ? `${projectExecutionSettingsHref(pid, { envNote: "prototype" })}#execution-setup-panel`
    : "/project-admin/settings";
  const projectInfoHref = hasProjectContext ? `/requirements?projectId=${encodedProjectId}` : "/";
  const projectMembersHref = hasProjectContext ? projectMembersAdminHref(pid) : "/project-members";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        const json = (await res.json()) as {
          success?: boolean;
          data?: { id?: string | null; isPlatformAdmin?: boolean; email?: string | null } | null;
        };
        if (!cancelled) {
          const data = json.data;
          const sid = String(data?.id ?? "").trim();
          setSessionPresent(Boolean(res.ok && json.success && data && sid));
          setIsPlatformAdmin(Boolean(res.ok && json.success && data && data.isPlatformAdmin));
        }
      } catch {
        if (!cancelled) {
          setSessionPresent(false);
          setIsPlatformAdmin(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: "4px 2px 8px" }}>
      {sessionPresent ? (
        <>
          {sectionTitle("내 계정", { first: true })}
          {row(
            "Settings · Integrations",
            <Link href="/integrations" prefetch={false} style={linkStyle}>
              열기
            </Link>,
          )}
          {row(
            "설정 메뉴 모드",
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
                maxWidth: 200,
              }}
            >
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => prefs.setSettingsMenuPersona("user")}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 8,
                    border: prefs.settingsMenuPersona === "user" ? "2px solid #0d9488" : "1px solid #e2e8f0",
                    background: prefs.settingsMenuPersona === "user" ? "#ecfdf5" : "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    color: "#0f172a",
                  }}
                >
                  일반
                </button>
                <button
                  type="button"
                  title="플랫폼 관리 메뉴를 켭니다. 실제 콘솔은 플랫폼 관리자만 이용할 수 있습니다."
                  onClick={() => prefs.setSettingsMenuPersona("admin")}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 8,
                    border: prefs.settingsMenuPersona === "admin" ? "2px solid #0d9488" : "1px solid #e2e8f0",
                    background: prefs.settingsMenuPersona === "admin" ? "#ecfdf5" : "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    color: "#0f172a",
                  }}
                >
                  관리자
                </button>
              </div>
              {prefs.settingsMenuPersona === "admin" && !isPlatformAdmin ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: 1.45,
                    color: "#64748b",
                    textAlign: "right",
                  }}
                >
                  플랫폼 관리자가 아니면「플랫폼 사용자」등 관리 콘솔이 보이지 않습니다. 로컬에서는 서버 환경변수{" "}
                  <code style={{ fontSize: 10, background: "#f1f5f9", padding: "1px 4px", borderRadius: 4 }}>
                    JYO_PLATFORM_ADMIN_EMAILS
                  </code>{" "}
                  에 본인 이메일을 넣거나, DB의 <code style={{ fontSize: 10, background: "#f1f5f9", padding: "1px 4px", borderRadius: 4 }}>globalRole</code>을{" "}
                  <code style={{ fontSize: 10, background: "#f1f5f9", padding: "1px 4px", borderRadius: 4 }}>ADMIN</code>
                  으로 올려 주세요.
                </p>
              ) : null}
            </div>,
          )}
          {isPlatformAdmin && prefs.settingsMenuPersona === "admin" ? (
            <>
              {sectionTitle("관리자 콘솔")}
              {row(
                "AI 멤버 관리",
                <Link href="/settings/ai-members" prefetch={false} style={linkStyle}>
                  열기
                </Link>,
              )}
              {row(
                "플랫폼 사용자",
                <Link href="/admin/platform-users" prefetch={false} style={linkStyle}>
                  열기
                </Link>,
              )}
            </>
          ) : null}
        </>
      ) : null}

      {sectionTitle("화면 레이아웃", { first: !sessionPresent })}
      <div style={{ marginBottom: 4 }}>
        <WorkspaceModeSwitcher variant="menu" />
      </div>

      <>
        {sectionTitle("프로젝트")}
        {row(
          "프로젝트 정보",
          <Link
            href={projectInfoHref}
            prefetch={false}
            title={hasProjectContext ? undefined : "홈에서 프로젝트를 선택한 뒤 이용하세요"}
            style={linkStyle}
          >
            열기
          </Link>,
        )}
        {row(
          "멤버 관리",
          <Link
            href={projectMembersHref}
            prefetch={false}
            title={hasProjectContext ? undefined : "프로젝트를 선택한 뒤 멤버를 관리하세요"}
            style={linkStyle}
          >
            열기
          </Link>,
        )}

        {sectionTitle("연동")}
        {row(
          "GitHub",
          <Link href={projectSettingsHref} prefetch={false} style={linkStyle}>
            열기
          </Link>,
        )}
        {row(
          "Cursor",
          <Link href={projectSettingsHref} prefetch={false} style={linkStyle}>
            열기
          </Link>,
        )}
        {row(
          "실행 환경",
          <Link href={projectSettingsHref} prefetch={false} style={linkStyle}>
            열기
          </Link>,
        )}
      </>

      {sectionTitle("화면")}

      {row(
        "화면 라벨 표시",
        <input
          type="checkbox"
          checked={ready ? enabled : false}
          onChange={(e) => setEnabled(e.target.checked)}
          style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
        />,
      )}

      {isPlatformAdmin ? (
        <>
          {sectionTitle("고급")}
          {row(
            "개발 패널 표시",
            <input
              type="checkbox"
              checked={prefs.devPanelVisible}
              onChange={(e) => prefs.setDevPanelVisible(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
            />,
          )}
        </>
      ) : null}
    </div>
  );
}
