"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PlatformSettingsMenu } from "@/components/layout/PlatformSettingsMenu";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";

const PLATFORM_HEADER_TAGLINE =
  "AI와 전문가의 도움으로 아이디어를 구체화하고 프로토타입 제작을 지원하는 플랫폼";

type MeState = {
  name: string;
  email: string;
  isPlatformAdmin: boolean;
};

export function PlatformTopNav() {
  const showScreenLabels = useShowScreenLabels();
  const [me, setMe] = useState<MeState | null>(null);
  const [meReady, setMeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = (await res.json()) as {
          success?: boolean;
          data?: { name?: string | null; email?: string | null; isPlatformAdmin?: boolean } | null;
        };
        if (cancelled) return;
        if (json.success && json.data?.email) {
          setMe({
            name: String(json.data.name ?? "").trim() || "사용자",
            email: String(json.data.email ?? "").trim(),
            isPlatformAdmin: Boolean(json.data.isPlatformAdmin),
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
  }, []);

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
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 12,
          rowGap: 12,
          minHeight: 44,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 2,
            minWidth: 0,
            flex: "1 1 200px",
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
          <span
            className="jyo-platform-tagline"
            title={PLATFORM_HEADER_TAGLINE}
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: "#64748b",
              lineHeight: 1.35,
              letterSpacing: "-0.01em",
              minWidth: 0,
              overflow: "hidden",
              whiteSpace: "normal",
              textOverflow: "clip",
            }}
          >
            {PLATFORM_HEADER_TAGLINE}
          </span>
        </div>

        <div style={{ flex: "1 1 16px", minWidth: 8 }} aria-hidden />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            rowGap: 10,
            flex: "1 1 260px",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
              minWidth: 0,
              flex: "1 1 160px",
            }}
          >
            {meReady && me ? (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#334155",
                  maxWidth: "min(100%, 320px)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {me.name} <span style={{ fontWeight: 500, color: "#64748b" }}>({me.email})</span>
              </span>
            ) : meReady ? (
              <span style={{ fontSize: 13, color: "#94a3b8" }}>로그인 필요</span>
            ) : (
              <span style={{ fontSize: 13, color: "#94a3b8" }}>…</span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end", gap: 8, flexShrink: 0 }}>
            {me ? (
              <button
                type="button"
                data-testid="platform-top-logout"
                onClick={() => void handleLogout()}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#334155",
                }}
              >
                로그아웃
              </button>
            ) : null}
            {me?.isPlatformAdmin ? (
              <Link
                href="/admin/platform-users"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#475569",
                  textDecoration: "none",
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                플랫폼 사용자
              </Link>
            ) : null}
            <PlatformSettingsMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
