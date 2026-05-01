"use client";

import type { ReactNode } from "react";
import { DesktopShell } from "@/components/layout/DesktopShell";
import { MobileShell } from "@/components/layout/MobileShell";
import type { MobileNavTabId } from "@/components/layout/MobileBottomNav";
import { useViewport } from "@/components/layout/useViewport";

export type ResponsiveShellProps = Readonly<{
  children: ReactNode;
  title?: string;
  currentNav?: MobileNavTabId;
  onNavChange?: (id: MobileNavTabId) => void;
  actions?: ReactNode;
}>;

/**
 * Phase 1 responsive foundation: select desktop/mobile chrome by viewport (< 1024 = mobile).
 * Layout only: routing remains with the parent.
 */
export function ResponsiveShell(p: ResponsiveShellProps) {
  const { isMobile } = useViewport();

  if (isMobile) {
    return (
      <MobileShell
        title={p.title ?? "JYOrchestration"}
        currentNav={p.currentNav ?? "home"}
        onNavChange={p.onNavChange ?? (() => {})}
        topRightAction={p.actions}
      >
        {p.children}
      </MobileShell>
    );
  }

  return (
    <DesktopShell title={p.title} actions={p.actions}>
      {p.children}
    </DesktopShell>
  );
}

