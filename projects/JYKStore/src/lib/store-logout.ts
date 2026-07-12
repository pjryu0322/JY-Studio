import {
  logoutDestinationPath,
  type LogoutDestination,
} from "@/lib/account-menu";

export type StoreLogoutResult =
  | { ok: true }
  | {
      ok: false;
      code: "LOGOUT_FAILED";
      message: string;
    };

const SAFE_LOGOUT_FAILURE_MESSAGE =
  "로그아웃에 실패했습니다. 다시 시도해 주세요.";

/**
 * Pure logout orchestration for tests and shared clients.
 * Redirects only after logout() resolves successfully.
 * Never surfaces raw internal error text to callers.
 */
export async function performStoreLogout(input: {
  logout: () => Promise<void>;
  redirect: (path: string) => void;
  refresh?: () => void;
  destination: LogoutDestination;
  /** When false, only clears the server session (no navigation). Default true. */
  navigate?: boolean;
}): Promise<StoreLogoutResult> {
  try {
    await input.logout();
    if (input.navigate !== false) {
      input.redirect(logoutDestinationPath(input.destination));
      input.refresh?.();
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      code: "LOGOUT_FAILED",
      message: SAFE_LOGOUT_FAILURE_MESSAGE,
    };
  }
}

/**
 * Serialize concurrent logout attempts onto one in-flight Promise.
 * Later callers share the first destination's result (no extra redirect).
 */
export function createSharedLogoutExecutor(
  execute: (destination: LogoutDestination) => Promise<StoreLogoutResult>,
): (destination: LogoutDestination) => Promise<StoreLogoutResult> {
  let inFlight: Promise<StoreLogoutResult> | null = null;

  return (destination: LogoutDestination): Promise<StoreLogoutResult> => {
    if (inFlight) {
      return inFlight;
    }

    inFlight = execute(destination).finally(() => {
      inFlight = null;
    });

    return inFlight;
  };
}
