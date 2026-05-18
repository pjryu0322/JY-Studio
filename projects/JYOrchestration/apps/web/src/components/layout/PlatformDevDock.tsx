"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useGlobalPreferences } from "@/lib/preferences/useGlobalPreferences";

export function PlatformDevDock() {
  const { devPanelVisible } = useGlobalPreferences();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = (await res.json()) as { success?: boolean; data?: { isPlatformAdmin?: boolean } | null };
        if (!cancelled) setIsPlatformAdmin(Boolean(json.success && json.data?.isPlatformAdmin));
      } catch {
        if (!cancelled) setIsPlatformAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!devPanelVisible || !isPlatformAdmin) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 35,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "6px 12px",
        fontSize: 12,
        fontWeight: 600,
        color: "#334155",
        background: "rgba(241,245,249,0.96)",
        borderTop: "1px solid #e2e8f0",
        backdropFilter: "blur(6px)",
      }}
    >
      <span style={{ color: "#64748b" }}>개발</span>
      <Link href="/admin/platform-users" style={{ color: "#2563eb", textDecoration: "none" }}>
        플랫폼 사용자
      </Link>
    </div>
  );
}
