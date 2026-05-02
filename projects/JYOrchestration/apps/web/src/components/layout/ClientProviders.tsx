"use client";

import type { ReactNode } from "react";
import { GlobalPreferenceEffects } from "@/components/layout/GlobalPreferenceEffects";
import { WorkspaceModeProvider } from "@/components/layout/WorkspaceModeContext";
import { ScreenLabelsProvider } from "@/components/ui/ScreenLabelsContext";

export function ClientProviders({ children }: { readonly children: ReactNode }) {
  return (
    <ScreenLabelsProvider>
      <GlobalPreferenceEffects />
      <WorkspaceModeProvider>{children}</WorkspaceModeProvider>
    </ScreenLabelsProvider>
  );
}
