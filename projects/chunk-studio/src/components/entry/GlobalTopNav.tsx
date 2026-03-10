"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
  { href: "/workspace", label: "작업공간" },
  { href: "/jobs", label: "최근 작업" },
  { href: "/admin", label: "관리자" },
  { href: "/templates/builder", label: "템플릿" },
];

export default function GlobalTopNav() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        backdropFilter: "blur(10px)",
        background: "rgba(246, 248, 252, 0.86)",
        borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
      }}
    >
      <nav aria-label="Chunk Studio Global Navigation">
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              textDecoration: "none",
              color: "#102544",
              fontSize: 14,
              fontWeight: 800,
              marginRight: 6,
            }}
          >
            Chunk Studio
          </Link>
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                style={{
                  textDecoration: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  borderRadius: 999,
                  padding: "6px 10px",
                  color: active ? "#0f3f9e" : "#42526b",
                  background: active ? "rgba(59, 130, 246, 0.14)" : "transparent",
                  border: active ? "1px solid rgba(59, 130, 246, 0.22)" : "1px solid transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
