import { ApiKeysPageClient } from "@/components/ApiKeysPageClient";
import { StoreLoginGate } from "@/components/StoreLoginGate";
import { ConsumerWorkspaceShell } from "@/components/role-workspace/ConsumerWorkspaceShell";

export default function ApiKeysPage() {
  return (
    <StoreLoginGate>
      <ConsumerWorkspaceShell activeId="apiKeys" hasMyPacks>
        <ApiKeysPageClient />
      </ConsumerWorkspaceShell>
    </StoreLoginGate>
  );
}
