"use client";

import type { ReactNode } from "react";
import { RoleWorkspaceShell } from "@/components/role-workspace/RoleWorkspaceShell";
import { getAdminConsoleRailItems } from "@/lib/role-workspace/admin-review-rail";

export function AdminConsoleWorkspace({
  activeId,
  children,
}: {
  readonly activeId: string;
  readonly children: ReactNode;
}) {
  return (
    <RoleWorkspaceShell
      role="admin"
      title="관리자 콘솔"
      items={getAdminConsoleRailItems(activeId)}
    >
      {children}
    </RoleWorkspaceShell>
  );
}
