"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminAccountManagementPanel } from "@/components/AdminAccountManagementPanel";
import { useStoreLogout } from "@/hooks/useStoreLogout";
import { isAdminAccountRole } from "@/lib/account-role";
import { fetchAuthSession } from "@/lib/auth-api";
import { ROUTES } from "@/lib/routes";

function MenuLink({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-store-border bg-white px-4 py-3 active:bg-slate-50"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-xs text-store-muted">{description}</p>
      </div>
      <span className="shrink-0 text-store-accent" aria-hidden>
        →
      </span>
    </Link>
  );
}

export function AccountPageClient() {
  const { logoutAndRedirect, busy: logoutBusy, error: logoutError } = useStoreLogout();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const session = await fetchAuthSession();
      const admin = Boolean(
        session.loggedIn &&
          isAdminAccountRole(session.accountRole ?? session.user?.accountRole),
      );
      setLoggedIn(Boolean(session.loggedIn));
      setIsAdmin(admin);
      setAdminName(session.user?.name ?? null);
      setAdminEmail(session.user?.email ?? null);
    } catch {
      setLoggedIn(false);
      setIsAdmin(false);
      setAdminName(null);
      setAdminEmail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onLogout = async () => {
    try {
      await logoutAndRedirect("login");
    } catch {
      // keep screen; error via hook
    }
  };

  if (loading) {
    return <div className="min-h-[200px] rounded-2xl bg-slate-50" aria-hidden />;
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4 pb-8">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-5">
          <p className="text-sm font-bold text-amber-950">관리자 전용 메뉴입니다.</p>
          <p className="mt-1 text-xs text-amber-900">
            하단 계정 탭과 등록 계정 관리는 관리자만 사용할 수 있습니다.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {!loggedIn ? (
            <Link
              href={ROUTES.adminLogin}
              className="flex min-h-[48px] items-center justify-center rounded-2xl bg-store-accent text-sm font-bold text-white"
            >
              관리자 계정 로그인
            </Link>
          ) : (
            <Link
              href={ROUTES.accountProfile}
              className="flex min-h-[48px] items-center justify-center rounded-2xl bg-store-accent text-sm font-bold text-white"
            >
              내 프로필로 이동
            </Link>
          )}
          <Link
            href={ROUTES.home}
            className="flex min-h-[44px] items-center justify-center rounded-2xl border border-store-border text-sm font-semibold text-slate-800"
          >
            스토어 홈
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl">
            👤
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-slate-900">
              {adminName?.trim() || "관리자"}
            </p>
            <p className="mt-1 text-xs text-store-muted">{adminEmail}</p>
            <p className="mt-2 text-[11px] font-semibold text-slate-700">활성 역할: 관리자</p>
          </div>
        </div>
        <button
          type="button"
          disabled={logoutBusy}
          onClick={() => void onLogout()}
          className="mt-4 text-xs font-semibold text-store-muted underline-offset-2 hover:underline disabled:opacity-50"
        >
          {logoutBusy ? "로그아웃 중…" : "로그아웃"}
        </button>
        {logoutError ? (
          <p className="mt-2 text-xs text-red-700" role="alert">
            {logoutError}
          </p>
        ) : null}
      </div>

      <AdminAccountManagementPanel />

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-store-muted">
          관리자 도구
        </h2>
        <ul className="space-y-2 text-sm">
          <li>
            <MenuLink title="관리자 콘솔" description="지식팩 검수 및 승인" href={ROUTES.adminReviews} />
          </li>
          <li>
            <MenuLink title="운영 사용량 확인" description="API UsageLog 조회" href={ROUTES.adminOpsUsage} />
          </li>
          <li>
            <MenuLink title="AuditLog" description="감사 로그 조회" href={ROUTES.adminOpsAudit} />
          </li>
          <li>
            <MenuLink title="Ops 대시보드" description="Health, Quota, API Keys" href={ROUTES.adminOps} />
          </li>
          <li>
            <MenuLink title="내 프로필" description="표시 이름·연락처" href={ROUTES.accountProfile} />
          </li>
        </ul>
      </section>
    </div>
  );
}
