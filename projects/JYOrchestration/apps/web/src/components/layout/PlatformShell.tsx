import { Suspense, type ReactNode } from "react";
import { PlatformDevDock } from "@/components/layout/PlatformDevDock";
import { PlatformMainFrame } from "@/components/layout/PlatformMainFrame";
import { PlatformTopNav } from "@/components/layout/PlatformTopNav";
import { AppFlowGuidance } from "@/components/workflow/AppFlowGuidance";

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: "100dvh", width: "100%" }}>
      <Suspense fallback={<div style={{ height: 48, borderBottom: "1px solid #e2e8f0" }} aria-hidden />}>
        <PlatformTopNav />
      </Suspense>
      <div style={{ flex: "1 1 auto", minWidth: 0, minHeight: 0, width: "100%", display: "flex", flexDirection: "column" }}>
        <PlatformMainFrame>
          <Suspense fallback={<>{children}</>}>
            <AppFlowGuidance>{children}</AppFlowGuidance>
          </Suspense>
        </PlatformMainFrame>
      </div>
      <PlatformDevDock />
    </div>
  );
}
