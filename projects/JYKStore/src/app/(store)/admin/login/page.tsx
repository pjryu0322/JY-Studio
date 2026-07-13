import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** Legacy URL — admin uses the shared store login; role is checked after sign-in. */
export default function AdminLoginRedirectPage() {
  redirect(ROUTES.login);
}
