import { redirect } from "next/navigation";
import { StoreLoginForm } from "@/components/StoreLoginForm";
import { postAuthLandingPath } from "@/lib/account-role";
import { getStoreAuthSessionFromCookies } from "@/lib/auth-session";
import {
  ACCOUNT_PROFILE_LOGIN_HINT,
  ACCOUNT_PROFILE_LOGIN_TITLE,
} from "@/lib/role-based-ux-copy";
import { getStoreUserById } from "@/lib/store-auth-service";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getStoreAuthSessionFromCookies();
  if (session) {
    const user = await getStoreUserById(session.userId);
    redirect(postAuthLandingPath(user?.accountRole ?? "USER"));
  }

  return (
    <div className="space-y-4 pb-8 pt-2">
      <StoreLoginForm title={ACCOUNT_PROFILE_LOGIN_TITLE} hint={ACCOUNT_PROFILE_LOGIN_HINT} />
    </div>
  );
}
