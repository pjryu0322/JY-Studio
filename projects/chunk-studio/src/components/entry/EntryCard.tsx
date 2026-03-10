"use client";

import Link from "next/link";

interface EntryCardProps {
  title: string;
  subtitle: string;
  description: string;
  href: string;
}

export default function EntryCard({
  title,
  subtitle,
  description,
  href,
}: EntryCardProps) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        border: "1px solid #ddd",
        borderRadius: 12,
        background: "#fff",
        padding: 16,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ fontSize: 11, color: "#1e88e5", fontWeight: 600 }}>{subtitle}</div>
      <h3 style={{ margin: "6px 0 8px", fontSize: 18 }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.45 }}>{description}</p>
    </Link>
  );
}
