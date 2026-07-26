"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  isProviderAccountRole,
  parseAccountRole,
  type AccountRole,
} from "@/lib/account-role";
import { accountRoleDisplayLabel } from "@/lib/account-menu";
import { fetchAuthSession } from "@/lib/auth-api";
import { useStoreLogout } from "@/hooks/useStoreLogout";
import { BOTTOM_TABS, bottomTabActive, ROUTES, type BottomTabKey } from "@/lib/routes";
import { fetchProviderPacks } from "@/lib/provider-center-api";

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

/** Small chevron on the rail edge — collapse / expand. */
function RailEdgeArrow({
  collapsed,
  className = "h-3.5 w-3.5",
}: {
  readonly collapsed: boolean;
  readonly className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {collapsed ? <path d="m9 6 6 6-6 6" /> : <path d="m15 6-6 6 6 6" />}
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
    case "providerReview":
      return (
        <svg {...common}>
          <path d="M8 5h10a2 2 0 0 1 2 2v12H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          <path d="m10 12 2 2 4-4" />
          <path d="M10 17h5" />
        </svg>
      );
    case "admin":
      // Inbox — admin work queue (작업함), not a checklist/home icon.
      return (
        <svg {...common}>
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "account":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" />
        </svg>
      );
    case "opsUsage":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 15v-4" />
          <path d="M12 15V8" />
          <path d="M16 15v-6" />
        </svg>
      );
    case "opsAudit":
      return (
        <svg {...common}>
          <path d="M8 5h10a2 2 0 0 1 2 2v12H8a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
          <path d="M10 10h6M10 13h6M10 16h4" />
        </svg>
      );
    case "ops":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    default:
      return null;
  }
}

/** Role-scoped primary rail items (profile/logout stay separate at the bottom). */
export function appRailTabsForRole(role: AccountRole): typeof BOTTOM_TABS {
  if (role === "ADMIN") {
    const order: Array<(typeof BOTTOM_TABS)[number]["key"]> = [
      "admin",
      "categories",
      "account",
      "opsUsage",
      "opsAudit",
      "ops",
    ];
    return order
      .map((key) => BOTTOM_TABS.find((tab) => tab.key === key))
      .filter((tab): tab is (typeof BOTTOM_TABS)[number] => Boolean(tab));
  }
  if (role === "PROVIDER") {
    const order: Array<(typeof BOTTOM_TABS)[number]["key"]> = [
      "provider",
      "providerReview",
    ];
    return order
      .map((key) => BOTTOM_TABS.find((tab) => tab.key === key))
      .filter((tab): tab is (typeof BOTTOM_TABS)[number] => Boolean(tab));
  }
  return BOTTOM_TABS.filter(
    (tab) =>
      tab.key === "today" ||
      tab.key === "search" ||
      tab.key === "categories" ||
      tab.key === "myPacks",
  );
}

/**
 * Primary app navigation as a collapsible left icon rail.
 * Collapse control is a small edge chevron (not a top panel icon).
 */
export function BottomTabNav() {
  const pathname = usePathname();
  const { logoutAndRedirect, busy: logoutBusy } = useStoreLogout();
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [accountRole, setAccountRole] = useState<AccountRole>("USER");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [providerReviewBadge, setProviderReviewBadge] = useState<number>(0);

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
      if (!session.loggedIn || !session.user) {
        setLoggedIn(false);
        setAccountRole("USER");
        setDisplayName(null);
        setProviderReviewBadge(0);
        return;
      }
      setLoggedIn(true);
      const role = parseAccountRole(session.accountRole ?? session.user.accountRole);
      setAccountRole(role);
      setDisplayName(
        session.providerProfile?.displayName?.trim() ||
          session.user.name?.trim() ||
          null,
      );
      if (isProviderAccountRole(role)) {
        try {
          const packsRes = await fetchProviderPacks();
          setProviderReviewBadge(packsRes.summary?.providerReviewRequested ?? 0);
        } catch {
          setProviderReviewBadge(0);
        }
      } else {
        setProviderReviewBadge(0);
      }
    } catch {
      setLoggedIn(false);
      setAccountRole("USER");
      setDisplayName(null);
      setProviderReviewBadge(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  const tabs = useMemo(() => appRailTabsForRole(accountRole), [accountRole]);
  const railCollapsed = hydrated && collapsed;

  return (
    <div
      className={`relative sticky top-0 z-40 flex h-dvh shrink-0 ${
        railCollapsed ? "w-3" : "w-[3.85rem] sm:w-[4.125rem]"
      }`}
    >
      {!railCollapsed ? (
        <nav
          className="flex h-full w-full flex-col items-center border-r border-store-border bg-white/95 py-3 backdrop-blur-md"
          aria-label="주요 메뉴"
        >
          <ul className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto px-1.5">
            {tabs.map((tab) => {
              const active = bottomTabActive(tab.key as BottomTabKey, pathname);
              const badge =
                tab.key === "providerReview" && providerReviewBadge > 0
                  ? providerReviewBadge
                  : null;
              return (
                <li key={tab.key} className="relative">
                  <Link
                    href={tab.href}
                    title={
                      badge != null ? `${tab.label} ${badge}건` : tab.label
                    }
                    aria-label={
                      badge != null ? `${tab.label}, ${badge}건` : tab.label
                    }
                    className={`relative flex h-[3.025rem] w-[3.025rem] items-center justify-center rounded-xl transition ${
                      active
                        ? "bg-store-accent text-white shadow-sm"
                        : "text-store-muted hover:bg-slate-50 hover:text-slate-800"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <AppNavIcon tabKey={tab.key as BottomTabKey} />
                    {badge != null ? (
                      <span
                        className="absolute -left-0.5 -top-0.5 flex min-h-3.5 min-w-3.5 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[9px] font-bold leading-none text-white"
                        aria-hidden
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                    <span className="sr-only">{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto flex w-full flex-col items-center gap-1.5 border-t border-store-border px-1 pt-2">
            <Link
              href={loggedIn ? ROUTES.accountProfile : ROUTES.login}
              title={
                loggedIn
                  ? `${accountRoleDisplayLabel(accountRole)} · ${displayName || "사용자"}`
                  : "로그인"
              }
              aria-label={
                loggedIn
                  ? `프로필, ${accountRoleDisplayLabel(accountRole)}, ${displayName || "사용자"}`
                  : "로그인"
              }
              className={`flex w-full flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 transition ${
                pathname === ROUTES.accountProfile ||
                pathname.startsWith(`${ROUTES.accountProfile}/`)
                  ? "bg-store-accent text-white shadow-sm"
                  : "text-store-muted hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <ProfileIcon />
              {loggedIn ? (
                <span className="flex w-full flex-col items-center gap-0 leading-tight">
                  <span className="w-full truncate text-center text-[9px] font-semibold">
                    {accountRoleDisplayLabel(accountRole)}
                  </span>
                  <span className="w-full truncate text-center text-[9px] font-medium opacity-90">
                    {displayName || "사용자"}
                  </span>
                </span>
              ) : (
                <span className="w-full truncate text-center text-[9px] font-semibold">로그인</span>
              )}
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
      ) : (
        <div
          className="h-full w-full border-r border-store-border bg-white/95 backdrop-blur-md"
          aria-hidden
        />
      )}

      <button
        type="button"
        title={railCollapsed ? "메뉴 펼치기" : "메뉴 감추기"}
        aria-label={railCollapsed ? "메뉴 펼치기" : "메뉴 감추기"}
        aria-expanded={!railCollapsed}
        onClick={() => setCollapsedPersist(!railCollapsed)}
        className="absolute top-1/2 right-0 z-50 flex h-9 w-4 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-md border border-store-border bg-white text-store-muted shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
      >
        <RailEdgeArrow collapsed={railCollapsed} />
      </button>
    </div>
  );
}
