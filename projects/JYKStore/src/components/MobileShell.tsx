"use client";

import type { ReactNode } from "react";
import type { BottomTabId } from "@/types/knowledge-pack";
import { BottomTabNav } from "@/components/BottomTabNav";
import { SearchEntry } from "@/components/SearchEntry";

export function MobileShell(p: {
  readonly children: ReactNode;
  readonly activeTab: BottomTabId;
  readonly onTabChange: (tab: BottomTabId) => void;
  readonly onSearchPress?: () => void;
}) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-store-bg shadow-xl">
      <header className="sticky top-0 z-40 border-b border-store-border bg-store-bg/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-store-accent text-sm font-black text-white">
              JK
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900">JYKStore</span>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-store-border text-lg"
            aria-label="계정"
            onClick={() => p.onTabChange("account")}
          >
            👤
          </button>
        </div>
        <SearchEntry onPress={p.onSearchPress ?? (() => p.onTabChange("search"))} />
      </header>
      <main className="px-4 pb-24 pt-4">{p.children}</main>
      <BottomTabNav active={p.activeTab} onChange={p.onTabChange} />
    </div>
  );
}
