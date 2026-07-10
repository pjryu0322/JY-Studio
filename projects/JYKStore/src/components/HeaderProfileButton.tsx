"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProviderProfileEditor } from "@/components/ProviderProfileEditor";
import { isAdminAccountRole, isProviderAccountRole } from "@/lib/account-role";
import { fetchAuthSession, logoutStoreAccount } from "@/lib/auth-api";
import { fetchProviderProfile } from "@/lib/provider-center-api";
import type { ProviderProfileDto } from "@/lib/provider-profile-dto";
import {
  PROVIDER_ACCOUNT_MENU_LABEL,
  PROVIDER_PROFILE_MENU_LABEL,
} from "@/lib/role-based-ux-copy";
import { ROUTES } from "@/lib/routes";

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name?.trim() || email?.trim() || "?").charAt(0);
  return source.toUpperCase();
}

export function HeaderProfileButton() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [provider, setProvider] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [providerProfile, setProviderProfile] = useState<ProviderProfileDto | null>(null);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      if (!session.loggedIn || !session.user) {
        setLoggedIn(false);
        setLabel(null);
        setProvider(false);
        setIsAdmin(false);
        setProviderProfile(null);
        return;
      }
      const role = session.accountRole ?? session.user.accountRole;
      setLoggedIn(true);
      setLabel(
        initials(
          session.providerProfile?.displayName ?? session.user.name,
          session.user.email,
        ),
      );
      setIsAdmin(isAdminAccountRole(role));
      const isProvider =
        isProviderAccountRole(role) || Boolean(session.providerProfile);
      setProvider(isProvider);
      setProviderProfile(session.providerProfile ?? null);
    } catch {
      setLoggedIn(false);
      setLabel(null);
      setProvider(false);
      setIsAdmin(false);
      setProviderProfile(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!menuOpen && !editOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
        setEditOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen, editOpen]);

  const onLogout = async () => {
    setMenuOpen(false);
    setEditOpen(false);
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

  const openProviderEditor = async () => {
    setMenuOpen(false);
    setEditOpen(true);
    try {
      const res = await fetchProviderProfile();
      setProviderProfile(res.profile);
    } catch {
      // keep existing profile if fetch fails
    }
  };

  const logoutButton = loggedIn ? (
    <button
      type="button"
      onClick={() => void onLogout()}
      disabled={logoutBusy}
      className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-store-border bg-white px-3 text-xs font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
    >
      {logoutBusy ? "…" : "로그아웃"}
    </button>
  ) : null;

  if (isAdmin && loggedIn) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <div ref={rootRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setEditOpen(false);
              setMenuOpen((open) => !open);
            }}
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
                href={ROUTES.account}
                className="block px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                등록 계정 관리
              </Link>
              <Link
                href={ROUTES.accountProfile}
                className="block px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                onClick={() => setMenuOpen(false)}
              >
                프로필
              </Link>
              <button
                type="button"
                className="block w-full px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                onClick={() => void openProviderEditor()}
              >
                {PROVIDER_PROFILE_MENU_LABEL}
              </button>
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
              <button
                type="button"
                onClick={() => void onLogout()}
                disabled={logoutBusy}
                className="block w-full px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {logoutBusy ? "로그아웃 중…" : "로그아웃"}
              </button>
            </div>
          ) : null}
          {editOpen ? (
            <div className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border border-store-border bg-white shadow-card">
              <ProviderProfileEditor
                initial={providerProfile}
                onCancel={() => setEditOpen(false)}
                onSaved={(profile) => {
                  setProviderProfile(profile);
                  setLabel(initials(profile.displayName, null));
                }}
              />
            </div>
          ) : null}
        </div>
        {logoutButton}
      </div>
    );
  }

  if (!loggedIn) {
    return (
      <div className="flex shrink-0 items-center gap-2">
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

  return (
    <div className="flex shrink-0 items-center gap-2">
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setEditOpen(false);
            setMenuOpen((open) => !open);
          }}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-store-border bg-white text-sm font-bold text-slate-800 active:bg-slate-50"
          aria-label="프로필 메뉴"
          aria-expanded={menuOpen}
        >
          {label ?? "👤"}
          {provider ? (
            <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
              제공자
            </span>
          ) : null}
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-store-border bg-white shadow-card">
            {provider ? (
              <button
                type="button"
                className="block w-full px-4 py-3 text-left text-sm font-semibold text-slate-900 hover:bg-slate-50"
                onClick={() => void openProviderEditor()}
              >
                {PROVIDER_PROFILE_MENU_LABEL}
              </button>
            ) : null}
            <Link
              href={ROUTES.accountProfile}
              className="block px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              onClick={() => setMenuOpen(false)}
            >
              {PROVIDER_ACCOUNT_MENU_LABEL}
            </Link>
            <button
              type="button"
              onClick={() => void onLogout()}
              disabled={logoutBusy}
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {logoutBusy ? "로그아웃 중…" : "로그아웃"}
            </button>
          </div>
        ) : null}
        {editOpen ? (
          <div className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl border border-store-border bg-white shadow-card">
            <ProviderProfileEditor
              initial={providerProfile}
              onCancel={() => setEditOpen(false)}
              onSaved={(profile) => {
                setProviderProfile(profile);
                setLabel(initials(profile.displayName, null));
                setProvider(true);
              }}
            />
          </div>
        ) : null}
      </div>
      {logoutButton}
    </div>
  );
}
