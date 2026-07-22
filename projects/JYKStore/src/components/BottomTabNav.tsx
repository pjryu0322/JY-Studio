"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAdminAccountRole, isProviderAccountRole } from "@/lib/account-role";
import { fetchAuthSession } from "@/lib/auth-api";
import { useStoreLogout } from "@/hooks/useStoreLogout";
import { BOTTOM_TABS, bottomTabActive, ROUTES, type BottomTabKey } from "@/lib/routes";

const RAIL_COLLAPSED_KEY = "jykstore.app-rail.collapsed";

function LogoutIcon({ className = "h-[22px] w-[22px]" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="M16 8l4 4-4 4" />
      <path d="M10 12h10" />
    </svg>
  );
}

function ProfileIcon({ className = "h-[22px] w-[22px]" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
    </svg>
  );
}

function PanelCollapseIcon({ className = "h-5 w-5" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="m15 9-3 3 3 3" />
    </svg>
  );
}

function PanelExpandIcon({ className = "h-5 w-5" }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      <path d="m13 9 3 3-3 3" />
    </svg>
  );
}

function AppNavIcon({ tabKey }: { readonly tabKey: BottomTabKey }) {
  const common = {
    className: "h-[22px] w-[22px]",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (tabKey) {
    case "today":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="m15 15 4.5 4.5" />
        </svg>
      );
    case "categories":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "myPacks":
      return (
        <svg {...common}>
          <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" />
          <path d="M12 12v8M4 8.5l8 3.5 8-3.5" />
        </svg>
      );
    case "provider":
      return (
        <svg {...common}>
          <path d="M5 7h14v12H5z" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
          <path d="M9 12h6M9 15h4" />
        </svg>
      );
    case "account":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * Primary app navigation as a collapsible left icon rail.
 */
export function BottomTabNav() {
  const pathname = usePathname();
  const { logoutAndRedirect, busy: logoutBusy } = useStoreLogout();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isProvider, setIsProvider] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(RAIL_COLLAPSED_KEY) === "1");
    } catch {
      setCollapsed(false);
    }
    setHydrated(true);
  }, []);

  const setCollapsedPersist = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(RAIL_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // ignore quota / private mode
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      if (!session.loggedIn) {
        setLoggedIn(false);
        setIsAdmin(false);
        setIsProvider(false);
        return;
      }
      setLoggedIn(true);
      const role = session.accountRole ?? session.user?.accountRole;
      setIsAdmin(isAdminAccountRole(role));
      setIsProvider(
        isProviderAccountRole(role) || Boolean(session.providerProfile),
      );
    } catch {
      setLoggedIn(false);
      setIsAdmin(false);
      setIsProvider(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  const tabs = useMemo(
    () =>
      BOTTOM_TABS.filter((tab) => {
        if (tab.key === "account") return isAdmin;
        if (tab.key === "provider") return isProvider;
        return true;
      }),
    [isAdmin, isProvider],
  );

  if (hydrated && collapsed) {
    return (
      <div className="sticky top-0 z-40 flex h-dvh w-[2.475rem] shrink-0 flex-col items-center border-r border-store-border bg-white/95 py-3 backdrop-blur-md">
        <button
          type="button"
          title="메뉴 펼치기"
          aria-label="메뉴 펼치기"
          aria-expanded={false}
          onClick={() => setCollapsedPersist(false)}
          className="flex h-[2.475rem] w-[2.475rem] items-center justify-center rounded-lg text-store-muted transition hover:bg-slate-50 hover:text-slate-800"
        >
          <PanelExpandIcon />
        </button>
      </div>
    );
  }

  return (
    <nav
      className="sticky top-0 z-40 flex h-dvh w-[3.85rem] shrink-0 flex-col items-center border-r border-store-border bg-white/95 py-3 backdrop-blur-md sm:w-[4.125rem]"
      aria-label="주요 메뉴"
    >
      <div className="mb-1 px-1.5">
        <button
          type="button"
          title="메뉴 감추기"
          aria-label="메뉴 감추기"
          aria-expanded={true}
          onClick={() => setCollapsedPersist(true)}
          className="flex h-[2.475rem] w-[2.475rem] items-center justify-center rounded-lg text-store-muted transition hover:bg-slate-50 hover:text-slate-800 sm:h-11 sm:w-11"
        >
          <PanelCollapseIcon />
        </button>
      </div>

      <ul className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto px-1.5">
        {tabs.map((tab) => {
          const active = bottomTabActive(tab.key as BottomTabKey, pathname);
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                title={tab.label}
                aria-label={tab.label}
                className={`flex h-[3.025rem] w-[3.025rem] items-center justify-center rounded-xl transition ${
                  active
                    ? "bg-store-accent text-white shadow-sm"
                    : "text-store-muted hover:bg-slate-50 hover:text-slate-800"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <AppNavIcon tabKey={tab.key as BottomTabKey} />
                <span className="sr-only">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col items-center gap-1.5 border-t border-store-border px-1.5 pt-2">
        <Link
          href={loggedIn ? ROUTES.accountProfile : ROUTES.login}
          title={loggedIn ? "프로필" : "로그인"}
          aria-label={loggedIn ? "프로필" : "로그인"}
          className={`flex h-[3.025rem] w-[3.025rem] items-center justify-center rounded-xl transition ${
            pathname === ROUTES.accountProfile || pathname.startsWith(`${ROUTES.accountProfile}/`)
              ? "bg-store-accent text-white shadow-sm"
              : "text-store-muted hover:bg-slate-50 hover:text-slate-800"
          }`}
        >
          <ProfileIcon />
          <span className="sr-only">{loggedIn ? "프로필" : "로그인"}</span>
        </Link>

        {loggedIn ? (
          <button
            type="button"
            title="로그아웃"
            aria-label="로그아웃"
            disabled={logoutBusy}
            onClick={() => void logoutAndRedirect("login")}
            className="flex h-[3.025rem] w-[3.025rem] items-center justify-center rounded-xl text-store-muted transition hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            <LogoutIcon />
            <span className="sr-only">{logoutBusy ? "로그아웃 중…" : "로그아웃"}</span>
          </button>
        ) : null}
      </div>
    </nav>
  );
}
