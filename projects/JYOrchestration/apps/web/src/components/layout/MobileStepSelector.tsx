"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { uiTokens as t } from "@/components/ui/tokens";
import type { WorkflowStepMeta } from "@/lib/workflow/workflowStepMeta";

export type MobileStepSelectorItem = WorkflowStepMeta & {
  readonly href: string;
  readonly active: boolean;
};

export function MobileStepSelector({
  items,
  trailingSlot,
}: {
  readonly items: readonly MobileStepSelectorItem[];
  readonly trailingSlot?: ReactNode;
}) {
  const showScreenLabels = useShowScreenLabels();

  const activeLabel = useMemo(() => {
    return items.find((x) => x.active)?.label ?? "단계";
  }, [items]);

  return (
    <div aria-label="프로젝트 워크플로 및 관리" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div className="relative" style={{ position: "relative", minWidth: 0, flex: "1 1 auto" }}>
        <ScreenLabel label="공통-상단내비-워크플로우-현재단계" visible={showScreenLabels} />
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            whiteSpace: "normal",
            lineHeight: 1.2,
            maxHeight: "2.4em",
          }}
        >
          {activeLabel}
        </div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {trailingSlot}
      </div>
    </div>
  );
}

