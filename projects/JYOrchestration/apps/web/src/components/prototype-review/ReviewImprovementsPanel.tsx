"use client";

import type { CSSProperties } from "react";
import type { PrototypeImprovementItem } from "@/lib/prototype/prototypeReviewStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { uiTokens as t } from "@/components/ui/tokens";

const shell: CSSProperties = {
  boxSizing: "border-box",
  borderRadius: t.radiusLg,
  border: `1px solid ${t.border}`,
  background: t.bgCard,
  padding: 14,
  minHeight: 160,
};

export function ReviewImprovementsPanel(p: { readonly items: PrototypeImprovementItem[] | null }) {
  if (!p.items?.length) {
    return (
      <div style={shell}>
        <EmptyState
          title="개선안이 아직 없습니다"
          description="「개선안 보기」를 누르면 대화와 프리뷰 맥락을 바탕으로 목록을 만듭니다."
        />
      </div>
    );
  }

  return (
    <div style={shell} aria-label="개선안 목록">
      <div style={{ fontSize: 14, fontWeight: 800, color: t.textPrimary, marginBottom: 10 }}>개선안</div>
      <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: t.textSecondary, lineHeight: 1.55, display: "grid", gap: 10 }}>
        {p.items.map((it, i) => (
          <li key={`${it.title}-${i}`}>
            <strong style={{ color: t.textPrimary }}>{it.title}</strong>
            <div style={{ marginTop: 4 }}>{it.detail}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
