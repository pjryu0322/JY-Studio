import { Suspense } from "react";
import { SettingsPageClient } from "@/components/layout/SettingsPageClient";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main style={{ flex: "1 1 auto", minHeight: 0, padding: 16, color: "#64748b" }}>
          불러오는 중…
        </main>
      }
    >
      <SettingsPageClient />
    </Suspense>
  );
}
