import { AccountPageContent } from "@/components/AccountPageContent";
import { isAdminOpsConfigured } from "@/lib/admin-auth";

export default function AccountPage() {
  const showOperatorEntry = isAdminOpsConfigured() || process.env.NODE_ENV !== "production";

  return <AccountPageContent showOperatorEntry={showOperatorEntry} />;
}
