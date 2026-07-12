import {
  logoutDestinationPath,
  type LogoutDestination,
} from "@/lib/account-menu";

/**
 * Pure logout orchestration for tests and shared clients.
 * Redirects only after logout() resolves successfully.
 */
export async function performStoreLogout(input: {
  logout: () => Promise<void>;
  redirect: (path: string) => void;
  refresh?: () => void;
  destination: LogoutDestination;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await input.logout();
    input.redirect(logoutDestinationPath(input.destination));
    input.refresh?.();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "로그아웃에 실패했습니다. 다시 시도해 주세요.",
    };
  }
}
