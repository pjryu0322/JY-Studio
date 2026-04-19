import { Suspense, type ReactNode } from "react";
import { AppFlowGuidance } from "@/components/workflow/AppFlowGuidance";
import { PlatformTopNav } from "@/components/layout/PlatformTopNav";

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Suspense fallback={<div style={{ height: 48, borderBottom: "1px solid #e2e8f0" }} aria-hidden />}>
        <PlatformTopNav />
      </Suspense>
      <div style={{ flex: "1 1 auto", minWidth: 0, width: "100%" }}>
        <div style={{ maxWidth: 1600, margin: "0 auto", padding: "20px 24px 32px", width: "100%", boxSizing: "border-box" }}>
          <Suspense fallback={<>{children}</>}>
            <AppFlowGuidance>{children}</AppFlowGuidance>
          </Suspense>
        </div>
      </div>
    </div>
  );
}
