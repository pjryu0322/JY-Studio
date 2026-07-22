"use client";

import type { ReactNode } from "react";
import { RoleWorkspaceShell } from "@/components/role-workspace/RoleWorkspaceShell";
import { getConsumerRailState } from "@/lib/role-workspace/consumer-rail";

export function ConsumerWorkspaceShell({
  activeId,
  hasMyPacks,
  hasApiKey,
  hasUsage,
  children,
}: {
  readonly activeId: string;
  readonly hasMyPacks?: boolean;
  readonly hasApiKey?: boolean;
  readonly hasUsage?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <RoleWorkspaceShell
      role="consumer"
      title="나의 이용 흐름"
      items={getConsumerRailState({ activeId, hasMyPacks, hasApiKey, hasUsage })}
    >
      {children}
    </RoleWorkspaceShell>
  );
}
