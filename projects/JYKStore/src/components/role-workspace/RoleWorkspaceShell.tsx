"use client";

import type { ReactNode } from "react";
import type { RoleRailItem, RoleWorkspaceRole } from "@/lib/role-workspace/types";
import { RoleSideRail } from "@/components/role-workspace/RoleSideRail";

/**
 * Shared workspace chrome: always-visible left icon rail + main column.
 */
export function RoleWorkspaceShell({
  role,
  items,
  title,
  children,
}: {
  readonly role: RoleWorkspaceRole;
  readonly items: readonly RoleRailItem[];
  readonly title?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 sm:gap-4">
      <RoleSideRail role={role} items={items} title={title} />
      <div className="min-w-0 flex-1 space-y-4">{children}</div>
    </div>
  );
}
