"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { isAdminAccountRole } from "@/lib/account-role";
import { fetchAuthSession, logoutStoreAccount } from "@/lib/auth-api";
import { ROUTES } from "@/lib/routes";

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name?.trim() || email?.trim() || "?").charAt(0);
  return source.toUpperCase();
}

export function HeaderProfileButton() {
  const router = useRouter();
  const [label, setLabel] = useState<string | null>(null);
  const [provider, setProvider] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const loggedIn = Boolean(label);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      if (!session.loggedIn || !session.user) {
        setLabel(null);
        setProvider(false);
        setIsAdmin(false);
        return;
      }
      setLabel(initials(session.user.name, session.user.email));
      setProvider(Boolean(session.providerProfile));
      setIsAdmin(isAdminAccountRole(session.accountRole ?? session.user.accountRole));
    } catch {
      setLabel(null);
      setProvider(false);
      setIsAdmin(false);
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
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  const onLogout = async () => {
    setMenuOpen(false);
    setLogoutBusy(true);
    try {
      await logoutStoreAccount();
      await refresh();
      router.replace(ROUTES.login);
      router.refresh();
    } finally {
      setLogoutBusy(false);
    }
  };

  const profileButton = isAdmin ? (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-store-border bg-white text-sm font-bold text-slate-800 active:bg-slate-50"
        aria-label="관리자 메뉴"
        aria-expanded={menuOpen}
      >
        {label ?? "👤"}
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-slate-800 px-1.5 py-0.5 text-[8px] font-bold text-white">
          관리자
        </span>
      </button>
      {menuOpen ? (
        <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-store-border bg-white shadow-card">
          <Link
            href={ROUTES.accountProfile}
            className="block px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            onClick={() => setMenuOpen(false)}
          >
            프로필
          </Link>
          <Link
            href={ROUTES.admin}
            className="block px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            onClick={() => setMenuOpen(false)}
          >
            관리자 콘솔
          </Link>
          <Link
            href={ROUTES.adminReviews}
            className="block px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            onClick={() => setMenuOpen(false)}
          >
            검수 대기 목록
          </Link>
          <Link
            href={ROUTES.home}
            className="block px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            onClick={() => setMenuOpen(false)}
          >
            스토어 홈
          </Link>
        </div>
      ) : null}
    </div>
  ) : (
    <Link
      href={loggedIn ? ROUTES.accountProfile : ROUTES.login}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-store-border bg-white text-sm font-bold text-slate-800 active:bg-slate-50"
      aria-label={loggedIn ? "프로필 관리" : "로그인"}
    >
      {label ?? "👤"}
      {provider ? (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
          제공자
        </span>
      ) : null}
    </Link>
  );

  return (
    <div className="flex shrink-0 items-center gap-2">
      {profileButton}
      {loggedIn ? (
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={logoutBusy}
          className="min-h-[44px] shrink-0 rounded-xl border border-store-border bg-white px-3 text-xs font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
        >
          {logoutBusy ? "…" : "로그아웃"}
        </button>
      ) : null}
    </div>
  );
}
