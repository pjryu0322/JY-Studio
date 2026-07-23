"use client";

import type { ReactNode } from "react";

/**
 * Admin list/ops pages — content only (app left rail handles navigation).
 * No nested workspace rail.
 */
export function AdminConsoleWorkspace({
  children,
}: {
  readonly activeId?: string;
  readonly children: ReactNode;
}) {
  return <div className="min-w-0 space-y-4">{children}</div>;
}
