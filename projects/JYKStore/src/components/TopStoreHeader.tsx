"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { resolveStorePageChrome } from "@/lib/store-page-chrome";

/**
 * Content-top chrome shared by all store pages: title + description only.
 */
export function TopStoreHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const chrome = resolveStorePageChrome(pathname, searchParams);

  return (
    <div className="mb-1 min-w-0">
      <h1 className="text-lg font-bold tracking-tight text-slate-900">{chrome.title}</h1>
      {chrome.description.trim() ? (
        <p className="mt-1 truncate text-sm text-store-muted">{chrome.description}</p>
      ) : null}
    </div>
  );
}
