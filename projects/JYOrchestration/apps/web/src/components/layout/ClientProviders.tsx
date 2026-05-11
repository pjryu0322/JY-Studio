"use client";

import { useEffect, type ReactNode } from "react";
import { GlobalPreferenceEffects } from "@/components/layout/GlobalPreferenceEffects";
import { WorkspaceModeProvider } from "@/components/layout/WorkspaceModeContext";
import { subscribePlatformLogoutCloseSelf } from "@/lib/platform/platformPopupRegistry";
import { ScreenLabelsProvider } from "@/components/ui/ScreenLabelsContext";

function PlatformLogoutBroadcastListener() {
  useEffect(() => subscribePlatformLogoutCloseSelf(), []);
  return null;
}

export function ClientProviders({ children }: { readonly children: ReactNode }) {
  return (
    <ScreenLabelsProvider>
      <PlatformLogoutBroadcastListener />
      <GlobalPreferenceEffects />
      <WorkspaceModeProvider>{children}</WorkspaceModeProvider>
    </ScreenLabelsProvider>
  );
}
