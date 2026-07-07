"use client";

import type { ReactNode } from "react";
import { MobileShell } from "@/components/MobileShell";
import { MyPacksProvider } from "@/components/MyPacksProvider";

export default function StoreShellLayout({ children }: { readonly children: ReactNode }) {
  return (
    <MyPacksProvider>
      <MobileShell>{children}</MobileShell>
    </MyPacksProvider>
  );
}
