"use client";

import type { CSSProperties } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type LoadingStateProps = Readonly<{
  label?: string;
  className?: string;
  style?: CSSProperties;
}>;

export function LoadingState({ label = "불러오는 중…", className, style }: LoadingStateProps) {
  return (
    <p className={className} style={{ margin: 0, fontSize: 14, color: t.textMuted, fontWeight: 600, ...style }}>
      {label}
    </p>
  );
}
