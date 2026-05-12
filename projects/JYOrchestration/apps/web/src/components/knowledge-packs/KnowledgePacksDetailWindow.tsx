"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { uiTokens as t } from "@/components/ui/tokens";
import { KnowledgePackDetailPanel } from "@/components/knowledge-packs/KnowledgePackDetailPanel";
import { getKnowledgePackById } from "@/lib/knowledge-packs/developerKnowledgePacks";
import type { KnowledgePack } from "@/lib/knowledge-packs/types";

export function KnowledgePacksDetailWindow() {
  const searchParams = useSearchParams();
  const id = useMemo(() => String(searchParams.get("id") ?? "").trim(), [searchParams]);

  const [remotePack, setRemotePack] = useState<KnowledgePack | undefined | "missing">(undefined);
  const [remoteLoading, setRemoteLoading] = useState(false);

  const staticPack = useMemo(() => (id ? getKnowledgePackById(id) : undefined), [id]);

  useEffect(() => {
    if (!id) {
      setRemotePack(undefined);
      setRemoteLoading(false);
      return;
    }
    if (staticPack) {
      setRemotePack(undefined);
      setRemoteLoading(false);
      return;
    }
    let cancelled = false;
    setRemoteLoading(true);
    setRemotePack(undefined);
    void (async () => {
      try {
        const r = await fetch(`/api/knowledge-packs/${encodeURIComponent(id)}`);
        const j = (await r.json()) as { ok?: boolean; pack?: KnowledgePack };
        if (cancelled) return;
        if (j.ok && j.pack) setRemotePack(j.pack);
        else setRemotePack("missing");
      } catch {
        if (!cancelled) setRemotePack("missing");
      } finally {
        if (!cancelled) setRemoteLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, staticPack]);

  const pack = staticPack ?? (remotePack === "missing" ? undefined : remotePack);
  const loading = Boolean(id && !staticPack && remoteLoading);

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

      {loading ? (
        <div style={{ padding: 20, fontSize: 14, color: t.textMuted }}>불러오는 중…</div>
      ) : pack ? (
        <div style={{ flex: "1 1 auto", minHeight: 0, minWidth: 0, maxWidth: "100%", display: "flex", flexDirection: "column" }}>
          <KnowledgePackDetailPanel key={pack.id} pack={pack} embed />
        </div>
      ) : !id ? (
        <div style={{ padding: 20, border: `1px dashed ${t.border}`, borderRadius: t.radiusLg, color: t.textMuted, fontSize: 14 }}>
          유효한 지식팩 id가 없습니다. 목록에서 다시 열어 주세요.
        </div>
      ) : (
        <div style={{ padding: 20, border: `1px dashed ${t.border}`, borderRadius: t.radiusLg, color: t.textMuted, fontSize: 14 }}>
          유효한 지식팩 id가 없거나 권한이 없습니다. 목록에서 다시 열어 주세요.
        </div>
      )}
    </div>
  );
}
