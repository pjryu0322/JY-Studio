import { Suspense, type ReactNode } from "react";
import { PlatformDevDock } from "@/components/layout/PlatformDevDock";
import { PlatformTopNav } from "@/components/layout/PlatformTopNav";
import { AppFlowGuidance } from "@/components/workflow/AppFlowGuidance";

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Suspense fallback={<div style={{ height: 48, borderBottom: "1px solid #e2e8f0" }} aria-hidden />}>
        <PlatformTopNav />
      </Suspense>
      <div style={{ flex: "1 1 auto", minWidth: 0, width: "100%" }}>
        <div className="jyo-platform-main" style={{ maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <Suspense fallback={<>{children}</>}>
            <AppFlowGuidance>{children}</AppFlowGuidance>
          </Suspense>
        </div>
      </div>
      <PlatformDevDock />
    </div>
  );
}
