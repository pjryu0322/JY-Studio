"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { uiTokens as t } from "@/components/ui/tokens";
import { KnowledgePackDetailPanel } from "@/components/knowledge-packs/KnowledgePackDetailPanel";
import { getKnowledgePackById } from "@/lib/knowledge-packs/developerGridPacks";

export function KnowledgePacksDetailWindow() {
  const searchParams = useSearchParams();
  const id = useMemo(() => String(searchParams.get("id") ?? "").trim(), [searchParams]);
  const pack = id ? getKnowledgePackById(id) : undefined;

  return (
    <div
      style={{
        minHeight: "100%",
        minWidth: 0,
        maxWidth: "100%",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "12px 14px max(16px, env(safe-area-inset-bottom, 0px))",
        boxSizing: "border-box",
        background: t.bgPage,
      }}
    >
      <div style={{ flexShrink: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <h1 style={{ fontSize: 16, fontWeight: 900, color: t.textPrimary, margin: 0, flex: "1 1 auto" }}>지식팩 상세</h1>
        <Link
          href={pack ? `/knowledge-packs?id=${encodeURIComponent(pack.id)}` : "/knowledge-packs"}
          prefetch={false}
          style={{ fontSize: 13, fontWeight: 700, color: t.accentTealFg }}
        >
          목록으로
        </Link>
        <button
          type="button"
          onClick={() => {
            try {
              window.close();
            } catch {
              /* noop */
            }
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: "#fff",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: "pointer",
          }}
        >
          창 닫기
        </button>
      </div>

      {pack ? (
        <div style={{ flex: "1 1 auto", minHeight: 0, minWidth: 0, maxWidth: "100%", display: "flex", flexDirection: "column" }}>
          <KnowledgePackDetailPanel key={pack.id} pack={pack} embed />
        </div>
      ) : (
        <div style={{ padding: 20, border: `1px dashed ${t.border}`, borderRadius: t.radiusLg, color: t.textMuted, fontSize: 14 }}>
          유효한 지식팩 id가 없습니다. 목록에서 다시 열어 주세요.
        </div>
      )}
    </div>
  );
}
