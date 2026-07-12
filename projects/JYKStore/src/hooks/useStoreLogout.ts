"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { logoutStoreAccount } from "@/lib/auth-api";
import type { LogoutDestination } from "@/lib/account-menu";
import {
  createSharedLogoutExecutor,
  performStoreLogout,
  type StoreLogoutResult,
} from "@/lib/store-logout";

export type { LogoutDestination, StoreLogoutResult };

/**
 * Shared store logout: call server logout, then redirect only on success.
 * Concurrent callers share one Promise (first destination wins).
 */
export function useStoreLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const runLogoutRef = useRef<
    ((destination: LogoutDestination) => Promise<StoreLogoutResult>) | null
  >(null);
  const sharedRef = useRef<ReturnType<typeof createSharedLogoutExecutor> | null>(
    null,
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  runLogoutRef.current = async (destination) => {
    if (mountedRef.current) {
      setBusy(true);
      setError(null);
    }

    const result = await performStoreLogout({
      logout: logoutStoreAccount,
      redirect: (path) => router.replace(path),
      refresh: () => router.refresh(),
      destination,
    });

    if (!result.ok && mountedRef.current) {
      setError(result.message);
    }

    return result;
  };

  if (!sharedRef.current) {
    sharedRef.current = createSharedLogoutExecutor((destination) =>
      runLogoutRef.current!(destination),
    );
  }

  const clearError = useCallback(() => setError(null), []);

  const logoutAndRedirect = useCallback(
    (destination: LogoutDestination): Promise<StoreLogoutResult> => {
      const promise = sharedRef.current!(destination);
      void promise.finally(() => {
        if (mountedRef.current) {
          setBusy(false);
        }
      });
      return promise;
    },
    [],
  );

  return { logoutAndRedirect, busy, error, clearError };
}
