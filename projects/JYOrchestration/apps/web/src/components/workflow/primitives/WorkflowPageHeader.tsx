"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { uiTokens as t } from "@/components/ui/tokens";

export function WorkflowPageHeader({
  title,
  subtitle,
  right,
  backHref,
  backLabel = "뒤로",
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly right?: ReactNode;
  readonly backHref?: string;
  readonly backLabel?: string;
}) {
  const actions = (
    <>
      {right}
      {backHref ? (
        <Link
          href={backHref}
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: t.primary,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          {backLabel}
        </Link>
      ) : null}
    </>
  );

  const hasActions = Boolean(right) || Boolean(backHref);

  return (
    <PageHeader
      title={title}
      description={subtitle}
      actions={hasActions ? actions : undefined}
      style={{ marginBottom: 0 }}
    />
  );
}
