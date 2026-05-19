import { redirect } from "next/navigation";
import { HomePageClient } from "@/app/HomePageClient";
import { getAuthenticatedUserIdFromServerCookies } from "@/lib/auth/serverSession";

export default async function HomePage() {
  const userId = await getAuthenticatedUserIdFromServerCookies();
  if (!userId) {
    redirect("/login?from=/");
  }
  return <HomePageClient />;
}
