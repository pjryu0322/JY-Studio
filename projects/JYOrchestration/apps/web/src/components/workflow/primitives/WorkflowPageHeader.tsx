import Link from "next/link";
import { ReactNode } from "react";

export function WorkflowPageHeader({
  title,
  subtitle,
  right,
  backHref,
  backLabel = "뒤로",
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{subtitle}</div> : null}
      </div>
      <div style={{ flex: "0 0 auto", display: "flex", gap: 10, alignItems: "center" }}>
        {right}
        {backHref ? (
          <Link href={backHref} style={{ fontSize: 13, textDecoration: "underline" }}>
            {backLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

