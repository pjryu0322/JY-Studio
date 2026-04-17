import { Suspense, type ReactNode } from "react";
import { AppFlowGuidance } from "@/components/workflow/AppFlowGuidance";
import { PlatformSidebar } from "@/components/layout/PlatformSidebar";

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <PlatformSidebar />
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ padding: 24 }}>
          <Suspense fallback={<>{children}</>}>
            <AppFlowGuidance>{children}</AppFlowGuidance>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
