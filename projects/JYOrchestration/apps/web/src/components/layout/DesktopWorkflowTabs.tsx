"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { uiTokens as t } from "@/components/ui/tokens";
import type { WorkflowStepMeta } from "@/lib/workflow/workflowStepMeta";

const linkProcess = (active: boolean): CSSProperties => ({
  padding: "7px 14px",
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
  whiteSpace: "nowrap",
  border: active ? `1px solid ${t.primary}` : `1px solid ${t.border}`,
  background: active ? `${t.primary}14` : t.bgCard,
  color: active ? t.primary : t.textSecondary,
});

export type DesktopWorkflowTabItem = WorkflowStepMeta & {
  readonly href: string;
  readonly active: boolean;
};

export function DesktopWorkflowTabs({ items }: { readonly items: readonly DesktopWorkflowTabItem[] }) {
  const showScreenLabels = useShowScreenLabels();
  return (
    <nav aria-label="프로젝트 단계" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
      {items.map((item) => (
        <span key={item.stepId} className="relative">
          <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
          <Link href={item.href} style={linkProcess(item.active)} aria-current={item.active ? "page" : undefined}>
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

