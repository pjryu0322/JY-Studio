/** Shared visual tokens — JYOrchestration UI foundation (Phase 1) */
export const uiTokens = {
  radiusSm: 6,
  radiusMd: 8,
  radiusLg: 12,
  border: "#e2e8f0",
  borderStrong: "#cbd5e1",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  bgPage: "#f8fafc",
  bgCard: "#ffffff",
  primary: "#2563eb",
  /** Teal accent (홈·워크플로 CTA 등). */
  accentTeal: "#0d9488",
  accentTealFg: "#0f766e",
  accentTealSurface: "#ecfdf5",
  success: "#15803d",
  warning: "#b45309",
  danger: "#b91c1c",
  info: "#0369a1",
  /** Modal overlay (dialog scrim). */
  overlayScrim: "rgba(15, 23, 42, 0.45)",
  /** Elevated dialog / popover shadow. */
  shadowModal: "0 24px 60px rgba(15, 23, 42, 0.2)",
  /** Subtle card lift (inline panels). */
  shadowSoft: "0 4px 14px -8px rgba(15, 23, 42, 0.12)",
  /** Soft caution surface (inline notices). */
  surfaceCaution: "#fffbeb",
  borderCaution: "#fde68a",
  textCautionStrong: "#92400e",
  /** Soft info surface (mapping header). */
  surfaceInfoSoft: "#eff6ff",
  borderInfoSoft: "#bfdbfe",
} as const;

export type UiTokens = typeof uiTokens;
