import { Suspense, type ReactNode } from "react";
import { AppFlowGuidance } from "@/components/workflow/AppFlowGuidance";
import { PlatformSidebar } from "@/components/layout/PlatformSidebar";

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Suspense fallback={<aside style={{ width: 260, flex: "0 0 260px", borderRight: "1px solid #e5e5e5" }} aria-hidden />}>
        <PlatformSidebar />
      </Suspense>
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
