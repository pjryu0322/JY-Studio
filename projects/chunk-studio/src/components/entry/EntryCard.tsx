"use client";

import Link from "next/link";

interface EntryCardProps {
  variant: "operator" | "manager";
  title: string;
  description: string[];
  href: string;
  supportingText?: string;
}

export default function EntryCard({
  variant,
  title,
  description,
  href,
  supportingText,
}: EntryCardProps) {
  const isOperator = variant === "operator";
  return (
    <Link
      className="entry-role-card"
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "grid",
        gap: 12,
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
        padding: 22,
        transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          borderRadius: 999,
          padding: "4px 10px",
          display: "inline-flex",
          justifySelf: "start",
          color: isOperator ? "#1f4eb0" : "#3f3f9b",
          background: isOperator ? "rgba(70, 120, 255, 0.12)" : "rgba(99, 102, 241, 0.12)",
          border: isOperator ? "1px solid rgba(70, 120, 255, 0.24)" : "1px solid rgba(99, 102, 241, 0.26)",
        }}
      >
        {isOperator ? "Operator" : "Manager"}
      </div>
      <h2 style={{ margin: 0, fontSize: 30, color: isOperator ? "#0f2342" : "#1f2350", letterSpacing: "-0.02em" }}>
        {title}
      </h2>
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, color: "#5a6780", fontSize: 14 }}>
        {description.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: "#3156b9" }}>
        {supportingText ?? "선택하여 이동"}
      </div>
    </Link>
  );
}
