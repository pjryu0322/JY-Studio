"use client";

import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { uiTokens as t } from "@/components/ui/tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

function isLoadingChildLabel(children: ReactNode): boolean {
  if (typeof children !== "string") return false;
  const s = children.trim();
  return /\.\.\.|…/.test(s) || /^처리 중/u.test(s);
}

const sizeStyles: Record<ButtonSize, CSSProperties> = {
  sm: { padding: "6px 10px", fontSize: 12, fontWeight: 800 },
  md: { padding: "8px 14px", fontSize: 13, fontWeight: 800 },
  lg: { padding: "10px 18px", fontSize: 14, fontWeight: 800 },
};

const variantStyles: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: t.primary,
    color: "#fff",
    border: `1px solid ${t.primary}`,
  },
  secondary: {
    background: t.bgCard,
    color: t.textPrimary,
    border: `1px solid ${t.borderStrong}`,
  },
  ghost: {
    background: "transparent",
    color: t.textSecondary,
    border: `1px solid ${t.border}`,
  },
  danger: {
    background: t.bgCard,
    color: t.danger,
    border: `1px solid #fecaca`,
  },
};

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly children?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, disabled, children, className, style, type = "button", ...rest },
  ref,
) {
  const busy = Boolean(loading);
  const showLabel = busy && !isLoadingChildLabel(children) ? "처리 중…" : children;
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radiusMd,
    cursor: busy || disabled ? "not-allowed" : "pointer",
    opacity: busy || disabled ? 0.65 : 1,
    boxSizing: "border-box",
    lineHeight: 1.25,
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  return (
    <button
      ref={ref}
      type={type}
      disabled={Boolean(disabled) || busy}
      className={className}
      style={base}
      {...rest}
    >
      {showLabel}
    </button>
  );
});
