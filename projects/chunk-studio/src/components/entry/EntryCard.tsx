"use client";

import Link from "next/link";

interface EntryCardAction {
  label: string;
  href: string;
  emphasis?: "primary" | "secondary";
}

interface EntryCardIndicator {
  label: string;
  value: string;
}

interface EntryCardProps {
  variant: "operator" | "manager";
  icon: string;
  badge: string;
  title: string;
  description: string;
  actions: EntryCardAction[];
  indicators: EntryCardIndicator[];
}

export default function EntryCard({
  variant,
  icon,
  badge,
  title,
  description,
  actions,
  indicators,
}: EntryCardProps) {
  const isOperator = variant === "operator";
  return (
    <article
      style={{
        border: isOperator
          ? "1px solid rgba(87, 120, 255, 0.24)"
          : "1px solid rgba(99, 102, 241, 0.26)",
        boxShadow: isOperator
          ? "0 16px 36px rgba(19, 35, 72, 0.08)"
          : "0 16px 36px rgba(31, 41, 55, 0.08)",
        borderRadius: 18,
        background:
          variant === "operator"
            ? "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,251,255,0.95) 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(246,247,255,0.94) 100%)",
        padding: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 21 }}>{icon}</span>
        <span
          style={{
            fontSize: 11,
            color: isOperator ? "#1f4eb0" : "#3f3f9b",
            fontWeight: 700,
            borderRadius: 999,
            padding: "4px 10px",
            background: isOperator
              ? "rgba(70, 120, 255, 0.12)"
              : "rgba(99, 102, 241, 0.12)",
            border: isOperator
              ? "1px solid rgba(70, 120, 255, 0.24)"
              : "1px solid rgba(99, 102, 241, 0.26)",
          }}
        >
          {badge}
        </span>
      </div>
      <h3 style={{ margin: "10px 0 8px", fontSize: 22, color: isOperator ? "#0f2342" : "#1f2350" }}>
        {title}
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: "#5a6780", lineHeight: 1.5 }}>{description}</p>
      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            style={{
              textDecoration: "none",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              padding: "7px 11px",
              border:
                action.emphasis === "primary"
                  ? "1px solid #2459d9"
                  : "1px solid rgba(65, 84, 120, 0.28)",
              color: action.emphasis === "primary" ? "#fff" : "#2e3f5e",
              background:
                action.emphasis === "primary"
                  ? isOperator
                    ? "linear-gradient(135deg, #2b64f3, #1f4ed8)"
                    : "linear-gradient(135deg, #4f46e5, #4338ca)"
                  : "#fff",
              boxShadow:
                action.emphasis === "primary"
                  ? isOperator
                    ? "0 8px 16px rgba(37, 87, 220, 0.22)"
                    : "0 8px 16px rgba(79, 70, 229, 0.22)"
                  : "none",
            }}
          >
            {action.label}
          </Link>
        ))}
      </div>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 6,
        }}
      >
        {indicators.map((indicator) => (
          <div
            key={indicator.label}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(110, 129, 168, 0.2)",
              background: "#ffffff",
              padding: "6px 8px",
            }}
          >
            <div style={{ fontSize: 10, color: "#7a889f" }}>{indicator.label}</div>
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 700, color: "#213457" }}>
              {indicator.value}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
