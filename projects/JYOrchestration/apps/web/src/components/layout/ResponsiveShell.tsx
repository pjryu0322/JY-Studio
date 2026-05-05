"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { DesktopShell } from "@/components/layout/DesktopShell";
import { MobileShell } from "@/components/layout/MobileShell";
import { useViewport } from "@/components/layout/useViewport";

export type ResponsiveShellProps = Readonly<{
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
}>;

/**
 * Phase 1 responsive foundation: select desktop/mobile chrome by viewport (< 1024 = mobile).
 * Layout only: routing remains with the parent.
 */
export function ResponsiveShell(p: ResponsiveShellProps) {
  const { isMobile } = useViewport();
  /** 뷰포트 분기는 마운트 후에만 적용 — SSR·첫 페인트는 데스크톱 셸과 맞춰 하이드레이션 불일치를 막습니다. */
  const [layoutCommitted, setLayoutCommitted] = useState(false);
  useEffect(() => {
    setLayoutCommitted(true);
  }, []);

  if (layoutCommitted && isMobile) {
    return (
      <MobileShell title={p.title?.trim() ? p.title : undefined} topRightAction={p.actions}>
        {p.children}
      </MobileShell>
    );
  }

  const desktopTitle = p.title?.trim() || undefined;
  return (
    <DesktopShell title={desktopTitle} actions={p.actions}>
      {p.children}
    </DesktopShell>
  );
}

