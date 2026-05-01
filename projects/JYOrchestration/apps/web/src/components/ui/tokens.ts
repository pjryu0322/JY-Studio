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
} as const;

export type UiTokens = typeof uiTokens;
