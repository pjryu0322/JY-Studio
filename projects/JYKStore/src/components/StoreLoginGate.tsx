import type { ReactNode } from "react";
import { AuthRequiredCard } from "@/components/AuthRequiredCard";
import { getUserIdFromCookies } from "@/lib/auth-session";

export async function StoreLoginGate({ children }: { readonly children: ReactNode }) {
  const userId = await getUserIdFromCookies();
  if (!userId) {
    return <AuthRequiredCard />;
  }
  return children;
}
