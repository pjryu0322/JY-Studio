"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { logoutStoreAccount } from "@/lib/auth-api";
import type { LogoutDestination } from "@/lib/account-menu";
import { performStoreLogout } from "@/lib/store-logout";

export type { LogoutDestination };

/**
 * Shared store logout: call server logout, then redirect only on success.
 * Failures keep the current screen and surface an error.
 */
export function useStoreLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const logoutAndRedirect = useCallback(
    async (destination: LogoutDestination): Promise<void> => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const result = await performStoreLogout({
          logout: logoutStoreAccount,
          redirect: (path) => router.replace(path),
          refresh: () => router.refresh(),
          destination,
        });
        if (!result.ok) {
          setError(result.message);
          throw new Error(result.message);
        }
      } finally {
        inFlightRef.current = false;
        setBusy(false);
      }
    },
    [router],
  );

  return { logoutAndRedirect, busy, error, clearError };
}
