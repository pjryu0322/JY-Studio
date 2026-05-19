"use client";

import { useEffect, type ReactNode } from "react";
import { GlobalPreferenceEffects } from "@/components/layout/GlobalPreferenceEffects";
import { WorkingSurfaceLayoutEffect } from "@/components/layout/WorkingSurfaceLayoutEffect";
import { WorkspaceModeProvider } from "@/components/layout/WorkspaceModeContext";
import { subscribePlatformLogoutCloseSelf } from "@/lib/platform/platformPopupRegistry";
import { SessionAuthGuard } from "@/components/layout/SessionAuthGuard";
import { ScreenLabelsProvider } from "@/components/ui/ScreenLabelsContext";

function PlatformLogoutBroadcastListener() {
  useEffect(() => subscribePlatformLogoutCloseSelf(), []);
  return null;
}

export function ClientProviders({ children }: { readonly children: ReactNode }) {
  return (
    <ScreenLabelsProvider>
      <PlatformLogoutBroadcastListener />
      <SessionAuthGuard />
      <GlobalPreferenceEffects />
      <WorkspaceModeProvider>
        <WorkingSurfaceLayoutEffect />
        {children}
      </WorkspaceModeProvider>
    </ScreenLabelsProvider>
  );
}
