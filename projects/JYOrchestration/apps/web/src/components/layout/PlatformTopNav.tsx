"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { TopRightToolbar } from "@/components/layout/TopRightToolbar";
import { useWorkspaceMode } from "@/components/layout/WorkspaceModeContext";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { resolveWorkflowProjectContextId } from "@/lib/workflow/flow-state";
import { fetchProjectById } from "@/components/project-spec/api";

type MeState = {
  id: string;
  displayName: string;
  email: string;
  isPlatformAdmin: boolean;
  avatarUrl: string | null;
};

export function PlatformTopNav() {
  const { effectiveLayout } = useWorkspaceMode();
  /** 하이드레이션 직후까지 false로 두어 서버 HTML과 첫 클라이언트 페인트가 같게 유지 */
  const [layoutHydrated, setLayoutHydrated] = useState(false);
  useEffect(() => {
    setLayoutHydrated(true);
  }, []);
  const compactHeader = layoutHydrated && effectiveLayout === "MOBILE";
  const showScreenLabels = useShowScreenLabels();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [me, setMe] = useState<MeState | null>(null);
  const [meReady, setMeReady] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const projectId = useMemo(
    () => resolveWorkflowProjectContextId(pathname, searchParams),
    [pathname, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json()) as {
          success?: boolean;
          data?: {
            id?: string | null;
            name?: string | null;
            displayName?: string | null;
            nickname?: string | null;
            email?: string | null;
            avatarUrl?: string | null;
            isPlatformAdmin?: boolean;
          } | null;
        };
        if (cancelled) return;
        // 홈 `loadSession`과 동일: 세션 사용자는 `data` 객체만 있으면 인정(이메일 비어 있음·지연 응답 대비).
        if (res.ok && json.success && json.data && String(json.data.id ?? "").trim()) {
          const email = String(json.data.email ?? "").trim();
          const d = String(json.data.displayName ?? "").trim();
          const nick = String(json.data.nickname ?? "").trim();
          const legal = String(json.data.name ?? "").trim();
          const displayName = d || nick || legal || "사용자";
          const av = String(json.data.avatarUrl ?? "").trim();
          setMe({
            id: String(json.data.id ?? "").trim(),
            displayName,
            email,
            isPlatformAdmin: Boolean(json.data.isPlatformAdmin),
            avatarUrl: av || null,
          });
        } else {
          setMe(null);
        }
      } catch {
        if (!cancelled) setMe(null);
      } finally {
        if (!cancelled) setMeReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [me?.avatarUrl, me?.id]);

  useEffect(() => {
    let cancelled = false;
    const pid = String(projectId ?? "").trim();
    if (!pid) {
      setProjectName(null);
      return () => {
        cancelled = true;
      };
    }
    void (async () => {
      try {
        const { project } = await fetchProjectById(pid);
        if (cancelled) return;
        const name = String(project?.name ?? "").trim();
        setProjectName(name || null);
      } catch {
        if (!cancelled) setProjectName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  }

  return (
    <header
      className="relative"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        borderBottom: "1px solid #e2e8f0",
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
      }}
    >
      <ScreenLabel label="공통-상단내비-전체" visible={showScreenLabels} />
      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          padding: "10px 20px",
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
          gap: 12,
          minHeight: 44,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
            flex: "1 1 auto",
            overflow: "hidden",
          }}
        >
          <Link
            href="/"
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: "#0f172a",
              textDecoration: "none",
              letterSpacing: "-0.02em",
              flexShrink: 0,
              lineHeight: 1.25,
            }}
          >
            JY Orchestration
          </Link>
          {projectName ? (
            <>
              <span aria-hidden style={{ color: "#cbd5e1", flexShrink: 0, fontWeight: 300, userSelect: "none" }}>
                |
              </span>
              <Link
                href="/"
                title={projectName}
                style={{
                  fontWeight: 700,
                  fontSize: 12.5,
                  color: "#64748b",
                  textDecoration: "none",
                  letterSpacing: "-0.01em",
                  minWidth: 0,
                  flex: "1 1 auto",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {projectName}
              </Link>
            </>
          ) : null}
        </div>

        <div style={{ flexShrink: 0, marginLeft: "auto", display: "flex", alignItems: "center", minWidth: 0 }}>
          <TopRightToolbar
            meReady={meReady}
            me={me}
            avatarLoadFailed={avatarLoadFailed}
            onAvatarError={() => setAvatarLoadFailed(true)}
            hasSession={Boolean(me)}
            compact={compactHeader}
            workNotesProjectId={projectId?.trim() ? projectId.trim() : null}
            workNotesProjectName={projectName}
            onLogout={handleLogout}
          />
        </div>
      </div>
    </header>
  );
}
