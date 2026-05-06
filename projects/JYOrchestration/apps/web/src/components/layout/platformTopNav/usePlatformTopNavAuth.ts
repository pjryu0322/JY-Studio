"use client";

import { useEffect, useState } from "react";

export type PlatformTopNavMeState = {
  id: string;
  displayName: string;
  email: string;
  isPlatformAdmin: boolean;
  avatarUrl: string | null;
};

export function usePlatformTopNavAuth(pathname: string): {
  readonly me: PlatformTopNavMeState | null;
  readonly meReady: boolean;
  readonly avatarLoadFailed: boolean;
  readonly setAvatarLoadFailed: (value: boolean) => void;
  readonly logout: () => Promise<void>;
} {
  const [me, setMe] = useState<PlatformTopNavMeState | null>(null);
  const [meReady, setMeReady] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

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

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  }

  return { me, meReady, avatarLoadFailed, setAvatarLoadFailed, logout };
}
