"use client";

import type { RoleRailItem, RoleWorkspaceRole } from "@/lib/role-workspace/types";
import { RoleRailItemView } from "@/components/role-workspace/RoleRailItem";

const ROLE_TITLE: Record<RoleWorkspaceRole, string> = {
  admin: "관리자 작업 흐름",
  provider: "제공자 작업 흐름",
  consumer: "나의 이용 흐름",
};

/**
 * Always-visible compact icon rail (all breakpoints).
 * Labels live in title/sr-only; status is shown as icon chrome + corner marks.
 */
export function RoleSideRail({
  role,
  items,
  title,
}: {
  readonly role: RoleWorkspaceRole;
  readonly items: readonly RoleRailItem[];
  readonly title?: string;
}) {
  const heading = title ?? ROLE_TITLE[role];

  return (
    <aside className="w-[3.85rem] shrink-0 self-stretch sm:w-[4.125rem]">
      <div className="sticky top-20 flex flex-col items-center gap-1.5 rounded-2xl border border-store-border bg-white px-1.5 py-2 shadow-card">
        <p className="sr-only">{heading}</p>
        <nav className="flex flex-col items-center gap-1.5" aria-label={heading}>
          {items.map((item) => (
            <RoleRailItemView key={item.id} item={item} />
          ))}
        </nav>
      </div>
    </aside>
  );
}
