import { ReactNode } from "react";
import { PlatformSidebar } from "@/components/layout/PlatformSidebar";

export function PlatformShell({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <PlatformSidebar />
      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

