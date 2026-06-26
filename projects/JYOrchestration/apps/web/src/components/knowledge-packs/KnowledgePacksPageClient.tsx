"use client";

import Link from "next/link";
import { KnowledgePacksBrowser } from "@/components/knowledge-packs/KnowledgePacksBrowser";
import { KnowledgePacksPageManagementSection } from "@/components/knowledge-packs/KnowledgePacksPageManagementSection";
import { uiTokens as t } from "@/components/ui/tokens";
import { useMediaQuery } from "@/components/ui/useMediaQuery";

export function KnowledgePacksPageClient() {
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const bottomPad = "max(72px, calc(env(safe-area-inset-bottom, 0px) + 56px))";
  const pagePadding = isNarrow ? `12px 12px ${bottomPad}` : `20px 20px ${bottomPad}`;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        padding: pagePadding,
        boxSizing: "border-box",
      }}
    >
      <div style={{ flexShrink: 0, marginBottom: 16, display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12, justifyContent: "space-between" }}>
        <h1 style={{ fontSize: isNarrow ? 20 : 22, fontWeight: 900, color: t.textPrimary, margin: 0 }}>지식팩</h1>
        <Link href="/workspace" prefetch={false} style={{ fontSize: 13, fontWeight: 700, color: t.accentTealFg }}>
          ← 프로젝트 목록
        </Link>
      </div>

      <KnowledgePacksPageManagementSection />

      <KnowledgePacksBrowser variant="page" />
    </div>
  );
}
