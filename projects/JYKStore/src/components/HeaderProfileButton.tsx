"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  isAdminAccountRole,
  isProviderAccountRole,
  parseAccountRole,
  type AccountRole,
} from "@/lib/account-role";
import {
  accountMenuLinksForRole,
  accountRoleDisplayLabel,
} from "@/lib/account-menu";
import { fetchAuthSession } from "@/lib/auth-api";
import { useStoreLogout } from "@/hooks/useStoreLogout";
import { ROUTES } from "@/lib/routes";

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name?.trim() || email?.trim() || "?").charAt(0);
  return source.toUpperCase();
}

type SessionView = {
  loggedIn: boolean;
  role: AccountRole;
  displayName: string | null;
  email: string | null;
  badge: "admin" | "provider" | null;
};

const emptySession: SessionView = {
  loggedIn: false,
  role: "USER",
  displayName: null,
  email: null,
  badge: null,
};

export function HeaderProfileButton() {
  const { logoutAndRedirect, busy: logoutBusy, error: logoutError, clearError } =
    useStoreLogout();
  const [session, setSession] = useState<SessionView>(emptySession);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAuthSession();
      if (!data.loggedIn || !data.user) {
        setSession(emptySession);
        return;
      }
      const role = parseAccountRole(data.accountRole ?? data.user.accountRole);
      const displayName =
        data.providerProfile?.displayName?.trim() ||
        data.user.name?.trim() ||
        null;
      setSession({
        loggedIn: true,
        role,
        displayName,
        email: data.user.email,
        badge: isAdminAccountRole(role)
          ? "admin"
          : isProviderAccountRole(role) || Boolean(data.providerProfile)
            ? "provider"
            : null,
      });
    } catch {
      setSession(emptySession);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const onLogout = async () => {
    clearError();
    const result = await logoutAndRedirect("login");
    if (result.ok) {
      setMenuOpen(false);
      setSession(emptySession);
    }
  };

  if (!session.loggedIn) {
    return (
      <div className="relative shrink-0">
        <Link
          href={ROUTES.login}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-store-border bg-white text-sm font-bold text-slate-800 active:bg-slate-50"
          aria-label="로그인"
        >
          👤
        </Link>
      </div>
    );
  }

  const menuLinks = accountMenuLinksForRole(session.role);
  const avatar = initials(session.displayName, session.email);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          clearError();
          setMenuOpen((open) => !open);
        }}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-store-border bg-white text-sm font-bold text-slate-800 active:bg-slate-50"
        aria-label="계정 메뉴 열기"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        {avatar}
        {session.badge === "admin" ? (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-slate-800 px-1.5 py-0.5 text-[8px] font-bold text-white">
            관리자
          </span>
        ) : null}
        {session.badge === "provider" ? (
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
            제공자
          </span>
        ) : null}
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-[100] mt-2 max-h-[calc(100vh-6rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-store-border bg-white shadow-card"
        >
          <div className="border-b border-store-border px-4 py-3">
            <p className="truncate text-sm font-bold text-slate-900">
              {session.displayName || "사용자"}
            </p>
            {session.email ? (
              <p className="mt-0.5 truncate text-xs text-store-muted">{session.email}</p>
            ) : null}
            <p className="mt-1 text-[11px] font-semibold text-slate-700">
              현재 역할: {accountRoleDisplayLabel(session.role)}
            </p>
          </div>

          {menuLinks.map((item) => (
            <Link
              key={`${item.label}:${item.href}`}
              href={item.href}
              role="menuitem"
              className="block min-h-[44px] px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          {logoutError ? (
            <p className="px-4 py-2 text-xs text-red-700" role="alert">
              {logoutError}
            </p>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={() => void onLogout()}
            disabled={logoutBusy}
            className="block min-h-[44px] w-full px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {logoutBusy ? "로그아웃 중…" : "로그아웃"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
