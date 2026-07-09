"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchAuthSession } from "@/lib/auth-api";
import { ROUTES } from "@/lib/routes";

function initials(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name?.trim() || email?.trim() || "?").charAt(0);
  return source.toUpperCase();
}

export function HeaderProfileButton() {
  const [label, setLabel] = useState<string | null>(null);
  const [provider, setProvider] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const session = await fetchAuthSession();
      if (!session.loggedIn || !session.user) {
        setLabel(null);
        setProvider(false);
        return;
      }
      setLabel(initials(session.user.name, session.user.email));
      setProvider(Boolean(session.providerProfile));
    } catch {
      setLabel(null);
      setProvider(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Link
      href={ROUTES.accountProfile}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-store-border bg-white text-sm font-bold text-slate-800 active:bg-slate-50"
      aria-label={label ? "프로필 관리" : "로그인"}
    >
      {label ?? "👤"}
      {provider ? (
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold text-white">
          제공자
        </span>
      ) : null}
    </Link>
  );
}
