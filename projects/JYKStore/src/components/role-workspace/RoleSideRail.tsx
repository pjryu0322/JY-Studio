"use client";

import { useState } from "react";
import type { RoleRailItem, RoleWorkspaceRole } from "@/lib/role-workspace/types";
import { RoleRailItemView } from "@/components/role-workspace/RoleRailItem";

const ROLE_TITLE: Record<RoleWorkspaceRole, string> = {
  admin: "관리자 작업 흐름",
  provider: "제공자 작업 흐름",
  consumer: "나의 이용 흐름",
};

export function RoleSideRail({
  role,
  items,
  title,
}: {
  readonly role: RoleWorkspaceRole;
  readonly items: readonly RoleRailItem[];
  readonly title?: string;
}) {
  const [open, setOpen] = useState(false);
  const heading = title ?? ROLE_TITLE[role];

  return (
    <>
      {/* Mobile: drawer trigger */}
      <div className="mb-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[40px] w-full items-center justify-between rounded-xl border border-store-border bg-white px-3 text-sm font-semibold text-slate-800 shadow-card"
        >
          <span>{heading}</span>
          <span className="text-xs font-normal text-store-muted">단계 보기</span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="닫기"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(100%,20rem)] flex-col gap-2 overflow-y-auto bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">{heading}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
              >
                닫기
              </button>
            </div>
            <nav className="space-y-1" aria-label={heading}>
              {items.map((item) => (
                <RoleRailItemView key={item.id} item={item} onNavigate={() => setOpen(false)} />
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      {/* Desktop: sticky left rail */}
      <aside className="hidden w-56 shrink-0 lg:block xl:w-64">
        <div className="sticky top-20 space-y-2 rounded-2xl border border-store-border bg-white p-3 shadow-card">
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-store-muted">{heading}</p>
          <nav className="space-y-1" aria-label={heading}>
            {items.map((item) => (
              <RoleRailItemView key={item.id} item={item} />
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
