import { MyPacksPageClient } from "@/components/MyPacksPageClient";
import { StoreLoginGate } from "@/components/StoreLoginGate";

export default function MyPacksPage() {
  return (
    <StoreLoginGate>
      <MyPacksPageClient />
    </StoreLoginGate>
  );
}
