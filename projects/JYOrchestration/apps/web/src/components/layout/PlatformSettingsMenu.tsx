"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUiLabel } from "@/lib/ui-label/useUiLabel";
import { useGlobalPreferences } from "@/lib/preferences/useGlobalPreferences";
import { projectExecutionSettingsHref } from "@/lib/project/projectExecutionSettingsHref";
import { projectMembersAdminHref } from "@/lib/project/projectMembersAdminHref";
import { resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";
import { WorkspaceModeSwitcher } from "@/components/layout/WorkspaceModeSwitcher";
import { getWorkspaceAiMember } from "@/lib/ai-member/platformAiMembers";

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6V4a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

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

type MenuCoords = { readonly top: number; readonly left: number; readonly width: number };

export function PlatformSettingsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuCoords, setMenuCoords] = useState<MenuCoords | null>(null);
  const { enabled, setEnabled, ready } = useUiLabel();
  const prefs = useGlobalPreferences();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [sessionPresent, setSessionPresent] = useState(false);
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const ideationAiAutoJoinLabel = useMemo(
    () => `${getWorkspaceAiMember("ideation")?.title ?? "AI 기획자"} 자동 참여`,
    [],
  );

  const projectId = resolveWorkflowProjectContextId(pathname, searchParams);
  const encodedProjectId = projectId ? encodeURIComponent(projectId) : "";
  const hasProjectContext = Boolean(projectId?.trim());
  const projectSettingsHref = hasProjectContext
    ? `${projectExecutionSettingsHref(projectId!, { envNote: "prototype" })}#execution-setup-panel`
    : "/project-admin/settings";

  const updateMenuPosition = useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const margin = 8;
    const width = Math.min(300, vw - margin * 2);
    const left = Math.min(Math.max(margin, r.right - width), vw - width - margin);
    setMenuCoords({ top: r.bottom + margin, left, width });
  }, []);

  const closeMenu = useCallback(() => {
    setMenuCoords(null);
    setOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    if (open) {
      closeMenu();
      return;
    }
    const anchor = rootRef.current;
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const margin = 8;
      const width = Math.min(300, vw - margin * 2);
      const left = Math.min(Math.max(margin, r.right - width), vw - width - margin);
      setMenuCoords({ top: r.bottom + margin, left, width });
    }
    setOpen(true);
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuPanelRef.current?.contains(t)) return;
      closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [closeMenu, open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={toggleMenu}
        aria-label="설정"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          padding: 0,
          borderRadius: 10,
          border: "1px solid #e2e8f0",
          background: open ? "#f1f5f9" : "#fff",
          color: "#475569",
          cursor: "pointer",
        }}
      >
        <GearIcon />
      </button>
      {open && menuCoords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuPanelRef}
              role="dialog"
              aria-label="설정"
              style={{
                position: "fixed",
                top: menuCoords.top,
                left: menuCoords.left,
                width: menuCoords.width,
                maxHeight: "min(70vh, 520px)",
                overflowY: "auto",
                padding: "12px 14px 14px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: "#fff",
                boxShadow: "0 10px 40px rgba(15, 23, 42, 0.12)",
                zIndex: 9999,
              }}
            >
              <p style={{ margin: "0 0 10px 0", fontSize: 15, fontWeight: 800, color: "#0f172a" }}>설정</p>

              {sessionPresent ? (
                <>
                  {sectionTitle("내 계정", { first: true })}
                  {row(
                    "계정 센터",
                    <Link
                      href="/account"
                      onClick={() => closeMenu()}
                      style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}
                    >
                      열기
                    </Link>,
                  )}
                  {row(
                    "Settings · Integrations",
                    <Link
                      href="/integrations"
                      onClick={() => closeMenu()}
                      style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}
                    >
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
                        "플랫폼 사용자",
                        <Link
                          href="/admin/platform-users"
                          onClick={() => closeMenu()}
                          style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}
                        >
                          열기
                        </Link>,
                      )}
                    </>
                  ) : null}
                </>
              ) : null}

              {sectionTitle("작업모드", { first: !sessionPresent })}
              <div style={{ marginBottom: 4 }}>
                <WorkspaceModeSwitcher variant="menu" />
              </div>

              {hasProjectContext ? (
                <>
                  {sectionTitle("프로젝트", { first: true })}
                  {row(
                    "프로젝트 정보",
                    <Link
                      href={`/requirements?projectId=${encodedProjectId}`}
                      onClick={() => closeMenu()}
                      style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}
                    >
                      열기
                    </Link>
                  )}
                  {row(
                    "멤버 관리",
                    <Link
                      href={projectMembersAdminHref(projectId!)}
                      onClick={() => closeMenu()}
                      style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}
                    >
                      열기
                    </Link>
                  )}

                  {sectionTitle("연동")}
                  {row(
                    "GitHub",
                    <Link
                      href={projectSettingsHref}
                      onClick={() => closeMenu()}
                      style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}
                    >
                      열기
                    </Link>
                  )}
                  {row(
                    "Cursor",
                    <Link
                      href={projectSettingsHref}
                      onClick={() => closeMenu()}
                      style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}
                    >
                      열기
                    </Link>
                  )}
                  {row(
                    "실행 환경",
                    <Link
                      href={projectSettingsHref}
                      onClick={() => closeMenu()}
                      style={{ fontSize: 12, fontWeight: 800, color: "#2563eb", textDecoration: "none" }}
                    >
                      열기
                    </Link>
                  )}
                </>
              ) : (
                <>
                  {sectionTitle("화면")}
                </>
              )}

              {row(
                "화면 라벨 표시",
                <input
                  type="checkbox"
                  checked={ready ? enabled : false}
                  onChange={(e) => setEnabled(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
                />
              )}

              {sectionTitle("AI")}
              {row(
                ideationAiAutoJoinLabel,
                <input
                  type="checkbox"
                  checked={prefs.aiFacilitatorAutoJoin}
                  onChange={(e) => prefs.setAiFacilitatorAutoJoin(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#2563eb", cursor: "pointer" }}
                />
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
                    />
                  )}
                </>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
