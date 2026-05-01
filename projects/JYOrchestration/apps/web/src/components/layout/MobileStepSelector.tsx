"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ScreenLabel } from "@/components/ui/ScreenLabel";
import { useShowScreenLabels } from "@/components/ui/ScreenLabelsContext";
import { uiTokens as t } from "@/components/ui/tokens";
import { BottomSheet } from "@/components/layout/BottomSheet";
import type { WorkflowStepMeta } from "@/components/layout/workflowStepMeta";

export type MobileStepSelectorItem = WorkflowStepMeta & {
  readonly href: string;
  readonly active: boolean;
};

export function MobileStepSelector({ items }: { readonly items: readonly MobileStepSelectorItem[] }) {
  const showScreenLabels = useShowScreenLabels();
  const [open, setOpen] = useState(false);

  const activeLabel = useMemo(() => items.find((x) => x.active)?.label ?? "단계", [items]);

  return (
    <div aria-label="프로젝트 워크플로 및 관리" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div className="relative" style={{ position: "relative", minWidth: 0 }}>
        <ScreenLabel label="공통-상단내비-워크플로우-현재단계" visible={showScreenLabels} />
        <div style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {activeLabel}
        </div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: `1px solid ${t.border}`,
            background: "#fff",
            fontSize: 12.5,
            fontWeight: 900,
            color: t.textSecondary,
            cursor: "pointer",
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          단계 변경
        </button>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel="프로젝트 단계 변경" zIndex={76}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>단계 변경</div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ border: 0, background: "transparent", color: t.textMuted, fontWeight: 900, cursor: "pointer", padding: "6px 8px", fontSize: 13 }}
          >
            닫기
          </button>
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          {items.map((item) => (
            <span key={item.stepId} className="relative">
              <ScreenLabel label={item.screenLabel} visible={showScreenLabels} />
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 14px",
                  borderRadius: 12,
                  textDecoration: "none",
                  border: item.active ? `2px solid ${t.primary}` : `1px solid ${t.border}`,
                  background: item.active ? `${t.primary}14` : "#fff",
                  color: "#0f172a",
                  fontSize: 14,
                  fontWeight: 800,
                  boxSizing: "border-box",
                }}
                aria-current={item.active ? "page" : undefined}
              >
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                {item.active ? <span style={{ fontSize: 12, fontWeight: 900, color: t.primary }}>현재</span> : null}
              </Link>
            </span>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}

