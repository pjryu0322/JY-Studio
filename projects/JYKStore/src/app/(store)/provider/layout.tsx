import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAdminAccountRole } from "@/lib/account-role";
import { getStoreAuthSessionFromCookies } from "@/lib/auth-session";
import { ROUTES } from "@/lib/routes";
import { getStoreUserById } from "@/lib/store-auth-service";

export const dynamic = "force-dynamic";

/** Admins cannot act as providers — send them to the admin work inbox. */
export default async function ProviderSectionLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const session = await getStoreAuthSessionFromCookies();
  if (session) {
    const user = await getStoreUserById(session.userId);
    if (isAdminAccountRole(user?.accountRole)) {
      redirect(ROUTES.admin);
    }
  }

  return children;
}
