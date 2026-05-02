"use client";

import type { ReactNode } from "react";
import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DesktopShell } from "@/components/layout/DesktopShell";
import { MobileShell } from "@/components/layout/MobileShell";
import type { MobileNavTabId } from "@/components/layout/MobileBottomNav";
import { useViewport } from "@/components/layout/useViewport";
import { appFlowStepHref, isPlatformHomeSurface, readLastFlowProjectId } from "@/lib/workflow/flow-state";

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
  const router = useRouter();
  const pathname = usePathname() || "/";

  const defaultMobileNav = useCallback(
    (id: MobileNavTabId) => {
      const last = readLastFlowProjectId();
      switch (id) {
        case "home":
          router.push("/");
          break;
        case "projects":
          if (isPlatformHomeSurface(pathname)) {
            const el = typeof document !== "undefined" ? document.getElementById("mobile-nav-projects") : null;
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            else router.push("/");
          } else {
            router.push("/");
          }
          break;
        case "chat":
          router.push(appFlowStepHref("requirements", last));
          break;
        case "runs":
          router.push(appFlowStepHref("execution", last));
          break;
        case "settings":
          router.push(
            last ? `/project-admin/settings?projectId=${encodeURIComponent(last)}` : "/project-admin/settings"
          );
          break;
        default:
          break;
      }
    },
    [pathname, router]
  );

  if (isMobile) {
    return (
      <MobileShell
        title={p.title?.trim() ? p.title : undefined}
        currentNav={p.currentNav ?? "home"}
        onNavChange={p.onNavChange ?? defaultMobileNav}
        topRightAction={p.actions}
      >
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

