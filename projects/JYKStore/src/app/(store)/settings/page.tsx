import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

/** Former settings hub — ops tools now live on the app left rail. */
export default function SettingsPage() {
  redirect(ROUTES.adminOps);
}
