import { Suspense, type ReactNode } from "react";
import { PlatformDevDock } from "@/components/layout/PlatformDevDock";
import { PlatformMainFrame } from "@/components/layout/PlatformMainFrame";
import { PlatformTopNavGate } from "@/components/layout/PlatformTopNavGate";
import { AppFlowGuidance } from "@/components/workflow/AppFlowGuidance";

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        flex: "1 1 auto",
        minHeight: 0,
        minWidth: 0,
        width: "100%",
        height: "100%",
        maxHeight: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <PlatformTopNavGate />
      <div style={{ flex: "1 1 auto", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
