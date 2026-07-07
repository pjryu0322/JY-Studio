"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BottomTabNav } from "@/components/BottomTabNav";
import { SearchEntry } from "@/components/SearchEntry";
import { TopStoreHeader } from "@/components/TopStoreHeader";
import { isTodayPath } from "@/lib/routes";

export function MobileShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const showSearchEntry = isTodayPath(pathname);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-store-bg shadow-xl">
      <header className="sticky top-0 z-40 border-b border-store-border bg-store-bg/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md">
        <TopStoreHeader />
        {showSearchEntry ? <SearchEntry /> : null}
      </header>
      <main className="px-4 pb-24 pt-4">{children}</main>
      <BottomTabNav />
    </div>
  );
}
