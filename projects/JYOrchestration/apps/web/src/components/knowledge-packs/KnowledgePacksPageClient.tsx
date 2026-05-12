"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWorkspaceModeOptional } from "@/components/layout/WorkspaceModeContext";
import { KnowledgePacksPageManagementSection } from "@/components/knowledge-packs/KnowledgePacksPageManagementSection";
import { uiTokens as t } from "@/components/ui/tokens";
import { useMediaQuery } from "@/components/ui/useMediaQuery";
import {
  filterKnowledgePacks,
  getKnowledgePackById,
  KNOWLEDGE_PACK_AGENT_LABEL,
  KNOWLEDGE_PACK_CATEGORY_LABEL,
} from "@/lib/knowledge-packs/developerKnowledgePacks";
import { formatKnowledgePackLicenseType } from "@/lib/knowledge-packs/knowledgePackFormat";
import {
  buildKnowledgePackDetailAbsoluteUrl,
  openKnowledgePackDetailWindow,
  resolveKnowledgePackOpenLayout,
  toOpenKnowledgePackWindowOptions,
} from "@/lib/knowledge-packs/openKnowledgePackDetailWindow";
import type { KnowledgePack, KnowledgePackAgent, KnowledgePackCategory } from "@/lib/knowledge-packs/types";

const AGENTS: Array<KnowledgePackAgent | "ALL"> = [
  "ALL",
  "AI_DEVELOPER",
  "AI_PLANNER",
  "AI_ANALYST",
  "AI_ARCHITECT",
  "AI_DESIGNER",
  "AI_REVIEWER",
  "AI_SECURITY",
];
const CATEGORIES: Array<KnowledgePackCategory | "ALL"> = ["ALL", "GRID", "AUTH", "SECURITY", "UI", "API", "DATA", "INTEGRATION"];

const filterSelectStyle = {
  minWidth: 160,
  padding: "8px 10px",
  borderRadius: t.radiusMd,
  border: `1px solid ${t.border}`,
  fontSize: 13,
  background: "#fff",
} as const;

export function KnowledgePacksPageClient() {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const workspaceModeCtx = useWorkspaceModeOptional();

  const [agentFilter, setAgentFilter] = useState<KnowledgePackAgent | "ALL">("AI_DEVELOPER");
  const [categoryFilter, setCategoryFilter] = useState<KnowledgePackCategory | "ALL">("GRID");

  const [mergedPacks, setMergedPacks] = useState<KnowledgePack[] | null>(null);
  const [listDegraded, setListDegraded] = useState(false);
  const [listLoading, setListLoading] = useState(true);

  const selectedId = useMemo(() => String(searchParams.get("id") ?? "").trim(), [searchParams]);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams();
    q.set("agent", agentFilter);
    q.set("category", categoryFilter);
    setListLoading(true);
    void (async () => {
      try {
        const r = await fetch(`/api/knowledge-packs?${q.toString()}`);
        const j = (await r.json()) as { ok?: boolean; packs?: KnowledgePack[]; degraded?: boolean };
        if (cancelled) return;
        if (j.ok && Array.isArray(j.packs)) {
          setMergedPacks(j.packs);
          setListDegraded(Boolean(j.degraded));
        } else {
          setMergedPacks(filterKnowledgePacks({ agent: agentFilter, category: categoryFilter }) as KnowledgePack[]);
          setListDegraded(true);
        }
      } catch {
        if (cancelled) return;
        setMergedPacks(filterKnowledgePacks({ agent: agentFilter, category: categoryFilter }) as KnowledgePack[]);
        setListDegraded(true);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentFilter, categoryFilter]);

  const filtered = mergedPacks ?? [];

  const selected = useMemo(() => {
    if (!filtered.length) return null;
    const fromFiltered = selectedId ? filtered.find((p) => p.id === selectedId) : undefined;
    if (fromFiltered) return fromFiltered;
    const fromStatic = selectedId ? getKnowledgePackById(selectedId) : undefined;
    if (fromStatic && filtered.some((p) => p.id === fromStatic.id)) return fromStatic;
    return filtered[0] ?? null;
  }, [selectedId, filtered]);

  useEffect(() => {
    if (!selected) return;
    if (selected.id === selectedId) return;
    const u = new URLSearchParams(searchParams.toString());
    u.set("id", selected.id);
    router.replace(`${pathname}?${u.toString()}`, { scroll: false });
  }, [selected, selectedId, router, pathname, searchParams]);

  const setPackId = useCallback(
    (id: string) => {
      const u = new URLSearchParams(searchParams.toString());
      u.set("id", id);
      router.replace(`${pathname}?${u.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const layoutOpenOpts = useMemo(() => toOpenKnowledgePackWindowOptions(workspaceModeCtx ?? undefined), [workspaceModeCtx]);

  const openDetailForPack = useCallback(
    (packId: string) => {
      setPackId(packId);
      const opened = openKnowledgePackDetailWindow(packId, layoutOpenOpts);
      if (!opened) {
        const { mode } = resolveKnowledgePackOpenLayout(layoutOpenOpts);
        window.open(buildKnowledgePackDetailAbsoluteUrl(packId, mode), "_blank", "noopener,noreferrer");
      }
    },
    [setPackId, layoutOpenOpts]
  );

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

      {listDegraded ? (
        <div
          style={{
            flexShrink: 0,
            marginBottom: 10,
            padding: "8px 12px",
            borderRadius: t.radiusMd,
            border: `1px solid ${t.border}`,
            background: "#fffbeb",
            fontSize: 12,
            color: "#92400e",
          }}
        >
          DB 목록을 불러오지 못해 정적 seed만 표시합니다. 네트워크·DB·로그인 상태를 확인해 주세요.
        </div>
      ) : null}

      <div
        style={{
          flexShrink: 0,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 12,
          alignItems: "flex-end",
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          AI Agent
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value as KnowledgePackAgent | "ALL")}
            style={filterSelectStyle}
          >
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a === "ALL" ? "전체" : KNOWLEDGE_PACK_AGENT_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 800, color: t.textSecondary }}>
          카테고리
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as KnowledgePackCategory | "ALL")}
            style={{ ...filterSelectStyle, minWidth: 140 }}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === "ALL" ? "전체" : KNOWLEDGE_PACK_CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {listLoading ? (
        <div style={{ padding: 16, fontSize: 14, color: t.textMuted }}>목록을 불러오는 중…</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: 24,
            borderRadius: t.radiusLg,
            border: `1px dashed ${t.border}`,
            color: t.textMuted,
            fontSize: 14,
          }}
        >
          선택한 Agent·카테고리에 해당하는 지식팩이 없습니다. 필터를 바꿔 보세요.
        </div>
      ) : (
        <div style={{ maxWidth: 760, width: "100%" }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: t.textMuted, letterSpacing: "0.04em", marginBottom: 8 }}>지식팩 목록</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((pack) => {
              const active = selected?.id === pack.id;
              const lic = formatKnowledgePackLicenseType(pack.license.type);
              return (
                <button
                  key={pack.id}
                  type="button"
                  data-testid={`knowledge-pack-list-${pack.id}`}
                  title="클릭하면 새 창에서 상세가 열립니다"
                  aria-label={`${pack.name} 상세를 새 창에서 열기`}
                  onClick={() => openDetailForPack(pack.id)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    borderRadius: t.radiusLg,
                    border: `1px solid ${active ? t.accentTeal : t.border}`,
                    background: active ? t.accentTealSurface : t.bgCard,
                    cursor: "pointer",
                    boxShadow: active ? `0 0 0 2px rgba(13, 148, 136, 0.18)` : t.shadowSoft,
                  }}
                >
                  <div style={{ fontSize: 15, fontWeight: 900, color: t.textPrimary, marginBottom: 6 }}>{pack.name}</div>
                  <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.45, marginBottom: 8 }}>
                    {pack.summary.length > 140 ? `${pack.summary.slice(0, 140)}…` : pack.summary}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 11, fontWeight: 800, color: t.textMuted }}>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f1f5f9" }}>Category: {KNOWLEDGE_PACK_CATEGORY_LABEL[pack.category]}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#f1f5f9" }}>
                      Agent: {pack.agents.map((a) => KNOWLEDGE_PACK_AGENT_LABEL[a]).join(", ")}
                    </span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#ecfdf5", color: t.accentTealFg }}>License: {lic}</span>
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: "#eff6ff", color: t.info }}>Status: {pack.status}</span>
                    {pack.source === "DB" ? (
                      <span style={{ padding: "2px 8px", borderRadius: 999, background: "#fae8ff", color: "#86198f" }}>DB</span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ flexShrink: 0, marginTop: 24, fontSize: 11, color: t.textMuted }}>
        정적 Grid seed와 등록한 DB 지식팩이 함께 표시됩니다. 상세:{" "}
        <code style={{ fontSize: 11 }}>/knowledge-packs/detail?id=…</code>
      </div>
    </div>
  );
}
