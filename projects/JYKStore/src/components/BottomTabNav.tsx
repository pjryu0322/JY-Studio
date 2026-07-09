"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BOTTOM_TABS, bottomTabActive } from "@/lib/routes";

export function BottomTabNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[1120px] -translate-x-1/2 border-t border-store-border bg-white/95 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:px-6 lg:px-8"
      aria-label="주요 메뉴"
    >
      <ul className="flex items-stretch justify-around">
        {BOTTOM_TABS.map((tab) => {
          const active = bottomTabActive(tab.key, pathname);
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                className={`flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-semibold ${
                  active ? "text-store-accent" : "text-store-muted"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <span className="text-base leading-none" aria-hidden>
                  {tab.icon}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
