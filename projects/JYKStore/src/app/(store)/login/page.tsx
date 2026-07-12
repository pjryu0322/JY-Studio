import { redirect } from "next/navigation";
import { StoreLoginForm } from "@/components/StoreLoginForm";
import { TestAccountQuickLogin } from "@/components/TestAccountQuickLogin";
import { postAuthLandingPath } from "@/lib/account-role";
import { getStoreAuthSessionFromCookies } from "@/lib/auth-session";
import {
  ACCOUNT_PROFILE_LOGIN_HINT,
  ACCOUNT_PROFILE_LOGIN_TITLE,
} from "@/lib/role-based-ux-copy";
import { getStoreUserById } from "@/lib/store-auth-service";
import { isTestAccountSwitcherConfigured } from "@/lib/test-account-switcher";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getStoreAuthSessionFromCookies();
  if (session) {
    const user = await getStoreUserById(session.userId);
    redirect(postAuthLandingPath(user?.accountRole ?? "USER"));
  }

  const showTestAccounts = isTestAccountSwitcherConfigured();

  return (
    <div className="space-y-4 pb-8 pt-2">
      {showTestAccounts ? (
        <>
          <TestAccountQuickLogin />
          <div className="flex items-center gap-3 px-1" aria-hidden="true">
            <div className="h-px flex-1 bg-store-border" />
            <span className="text-xs text-store-muted">또는</span>
            <div className="h-px flex-1 bg-store-border" />
          </div>
        </>
      ) : null}
      <StoreLoginForm title={ACCOUNT_PROFILE_LOGIN_TITLE} hint={ACCOUNT_PROFILE_LOGIN_HINT} />
    </div>
  );
}
