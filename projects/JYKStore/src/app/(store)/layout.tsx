"use client";

import type { ReactNode } from "react";
import { MobileShell } from "@/components/MobileShell";

export default function StoreShellLayout({ children }: { readonly children: ReactNode }) {
  return <MobileShell>{children}</MobileShell>;
}
