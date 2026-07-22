import { AccountPlanPanel } from "@/components/AccountPlanPanel";
import { StoreLoginGate } from "@/components/StoreLoginGate";

export const dynamic = "force-dynamic";

export default function AccountPlanPage() {
  return (
    <StoreLoginGate>
      <AccountPlanPanel />
    </StoreLoginGate>
  );
}
