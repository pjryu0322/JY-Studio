"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { BottomTabNav } from "@/components/BottomTabNav";
import { SearchEntry } from "@/components/SearchEntry";
import { TopStoreHeader } from "@/components/TopStoreHeader";
import { isTodayPath } from "@/lib/routes";

/**
 * Store frame: persistent left app rail + right content column (header + page).
 */
export function MobileShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const showSearchEntry = isTodayPath(pathname);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1120px] bg-store-bg shadow-xl">
      <BottomTabNav />
      <div className="flex min-w-0 flex-1 flex-col px-3 sm:px-5 lg:px-6">
        <header className="sticky top-0 z-30 border-b border-store-border bg-store-bg/95 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md">
          <TopStoreHeader />
          {showSearchEntry ? <SearchEntry /> : null}
        </header>
        <main className="flex-1 pb-6 pt-4">{children}</main>
      </div>
    </div>
  );
}
