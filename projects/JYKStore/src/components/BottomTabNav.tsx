"use client";

import type { BottomTabId } from "@/types/knowledge-pack";

const TABS: readonly { id: BottomTabId; label: string; icon: string }[] = [
  { id: "today", label: "투데이", icon: "☀" },
  { id: "search", label: "검색", icon: "⌕" },
  { id: "categories", label: "카테고리", icon: "▦" },
  { id: "library", label: "내 지식팩", icon: "📦" },
  { id: "account", label: "계정", icon: "👤" },
];

export function BottomTabNav(p: {
  readonly active: BottomTabId;
  readonly onChange: (tab: BottomTabId) => void;
}) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-store-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      aria-label="주요 메뉴"
    >
      <ul className="flex items-stretch justify-around">
        {TABS.map((tab) => {
          const active = p.active === tab.id;
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => p.onChange(tab.id)}
                className={`flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold ${
                  active ? "text-store-accent" : "text-store-muted"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="text-base leading-none" aria-hidden>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
