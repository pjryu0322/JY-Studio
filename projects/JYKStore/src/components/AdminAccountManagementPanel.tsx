"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountRole } from "@/lib/account-role";
import type { AdminAccountListItem } from "@/lib/admin-accounts-service";
import { fetchAdminAccountsApi, updateAdminAccountRoleApi } from "@/lib/admin-accounts-api";

const ROLE_OPTIONS: { value: AccountRole; label: string }[] = [
  { value: "USER", label: "일반 사용자" },
  { value: "PROVIDER", label: "제공자" },
  { value: "ADMIN", label: "관리자" },
];

function roleLabel(role: AccountRole): string {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
}

export function AdminAccountManagementPanel() {
  const [items, setItems] = useState<AdminAccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminAccountsApi();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "계정 목록을 불러오지 못했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onRoleChange = async (userId: string, accountRole: AccountRole) => {
    setBusyUserId(userId);
    setError(null);
    setMessage(null);
    try {
      const res = await updateAdminAccountRoleApi(userId, accountRole);
      setItems((prev) => prev.map((item) => (item.id === userId ? res.account : item)));
      setMessage(`${res.account.email ?? res.account.name ?? "계정"} 역할을 ${roleLabel(accountRole)}(으)로 변경했습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "역할 변경에 실패했습니다.");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="px-1">
        <h2 className="text-sm font-bold text-slate-900">등록 계정 관리</h2>
        <p className="mt-1 text-xs text-store-muted">
          스토어에 등록된 계정의 역할과 제공자 프로필 상태를 확인하고 변경합니다.
        </p>
      </div>

      {loading ? (
        <div className="min-h-[120px] rounded-2xl bg-slate-50" aria-hidden />
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-store-border bg-slate-50 px-4 py-6 text-center text-sm text-store-muted">
          등록된 계정이 없습니다.
        </div>
      ) : null}

      <ul className="space-y-2">
        {items.map((account) => (
          <li
            key={account.id}
            className="rounded-2xl border border-store-border bg-white p-4 shadow-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {account.name?.trim() || "이름 없음"}
                </p>
                <p className="mt-0.5 truncate text-xs text-store-muted">
                  {account.email ?? "(이메일 없음)"}
                </p>
                <p className="mt-2 text-[11px] text-store-muted">
                  가입 {account.createdAt.slice(0, 10)}
                  {account.hasProviderProfile
                    ? ` · 제공자 ${account.providerDisplayName ?? ""} · 지식팩 ${account.packCount}개`
                    : " · 제공자 프로필 없음"}
                </p>
              </div>
              <label className="block shrink-0 text-xs font-semibold text-slate-700">
                역할
                <select
                  value={account.accountRole}
                  disabled={busyUserId === account.id}
                  onChange={(e) =>
                    void onRoleChange(account.id, e.target.value as AccountRole)
                  }
                  className="mt-1 min-h-[40px] min-w-[120px] rounded-lg border border-store-border bg-white px-2 text-sm disabled:opacity-50"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
