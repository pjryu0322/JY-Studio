"use client";

import type { ReactNode } from "react";
import { ScreenLabelsProvider } from "@/components/ui/ScreenLabelsContext";

export function ClientProviders({ children }: { readonly children: ReactNode }) {
  return <ScreenLabelsProvider>{children}</ScreenLabelsProvider>;
}
