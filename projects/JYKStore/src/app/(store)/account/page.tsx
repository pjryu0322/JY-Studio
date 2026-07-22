import { AccountPageClient } from "@/components/AccountPageClient";
import { ConsumerWorkspaceShell } from "@/components/role-workspace/ConsumerWorkspaceShell";

export default function AccountPage() {
  return (
    <ConsumerWorkspaceShell activeId="account">
      <AccountPageClient />
    </ConsumerWorkspaceShell>
  );
}
